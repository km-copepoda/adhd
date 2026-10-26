/**
 * 使い捨ての家族ヘルパー（Issue #240）
 *
 * 共有の QA アカウントの状態（進化ステージ・タスク数など）を spec が書き換えて他の spec と干渉するのを防ぐため、
 * spec ごとに専用の家族を作り、終わったら家族ごと削除する。
 *
 * 手順:
 *   1. createFreshFamily で親1人・子1人の家族を作る（子は追加で作らない）
 *   2. premium のとき POST /api/dev/subscription で PREMIUM 化する（platform="E2E" の印が付く）
 *   3. 親がログインコードを発行し、子がログインする
 *
 * 後片付け:
 *   - disposeFamily(): premium なら DELETE /api/dev/subscription で解約 → DELETE /api/account で家族ごと削除 →
 *     finally で closeSessions()。処理中の Promise を保持するため、何度・同時に呼んでも同じ結果になる。
 *   - closeSessions(): 親・子の context を閉じ、storageState ファイルを削除する（何度呼んでも安全）。
 *
 * 禁止: 共有の QA アカウントにこのヘルパーの削除経路を使わない（自分が作った家族の親セッションでしか削除しない）。
 */
import fs from "fs/promises";
import {
  test,
  type APIRequestContext,
  type Browser,
  type BrowserContext,
} from "@playwright/test";
import {
  createBrowserContext,
  getBypassHeaders,
  issueChildLoginCode,
  submitChildLoginCode,
} from "../credentials";
import { createAnonymousContext } from "./authGuard";
import { createFreshFamily } from "./freshFamily";

export type DisposableSession = {
  context: BrowserContext;
  /** context と Cookie を共有する APIRequestContext。呼び出し時は getBypassHeaders() を明示的に付けること */
  request: APIRequestContext;
};

export type DisposableFamily = {
  parent: DisposableSession;
  child: DisposableSession;
  childId: string;
  disposeFamily: () => Promise<void>;
  closeSessions: () => Promise<void>;
};

function warn(message: string): void {
  try {
    test.info().annotations.push({ type: "disposable-family-warning", description: message });
  } catch {
    // テストの外から呼ばれた場合（afterAll の外など）は test.info() が投げる
    console.warn(`[disposableFamily] ${message}`);
  }
}

function e2eSetupHeaders(): Record<string, string> {
  const headers: Record<string, string> = { ...getBypassHeaders() };
  if (process.env.E2E_SETUP_SECRET) {
    headers["x-e2e-setup-secret"] = process.env.E2E_SETUP_SECRET;
  }
  return headers;
}

export async function createDisposableFamily(
  browser: Browser,
  options: { premium?: boolean } = {},
): Promise<DisposableFamily> {
  const premium = options.premium ?? false;
  const family = await createFreshFamily(browser);
  const stateFiles = [family.parentStatePath];

  const parentContext = await createBrowserContext(browser, family.parentStatePath, {
    bypass: "route",
  }).then(async ({ context, page }) => {
    await page.close();
    return context;
  });
  let childContext: BrowserContext | null = null;

  try {
    if (premium) {
      const res = await parentContext.request.post("/api/dev/subscription", {
        headers: e2eSetupHeaders(),
      });
      if (!res.ok()) {
        throw new Error(
          `PREMIUM化APIが失敗しました（status=${res.status()}）。ALLOW_E2E_SETUP / E2E_SETUP_SECRET を確認してください。`,
        );
      }
    }

    const anonymous = await createAnonymousContext(browser);
    childContext = anonymous.context;
    const code = await issueChildLoginCode(parentContext.request, family.childId);
    await submitChildLoginCode(anonymous.page, code);
    await anonymous.page.waitForURL("**/app/child/quests", { timeout: 15000 });
    await anonymous.page.close();
  } catch (e) {
    // 作りかけの家族は削除できる範囲で片付ける
    await parentContext.close().catch(() => {});
    await childContext?.close().catch(() => {});
    await Promise.all(stateFiles.map((f) => fs.rm(f, { force: true })));
    throw e;
  }

  const child = childContext;
  const sessions: DisposableSession[] = [
    { context: parentContext, request: parentContext.request },
    { context: child, request: child.request },
  ];
  const [parent, childSession] = sessions;

  const closed = { parent: false, child: false, files: false };
  const closeSessions = async (): Promise<void> => {
    if (!closed.parent) {
      closed.parent = true;
      await parentContext.close().catch(() => {});
    }
    if (!closed.child) {
      closed.child = true;
      await child.close().catch(() => {});
    }
    if (!closed.files) {
      closed.files = true;
      await Promise.all(stateFiles.map((f) => fs.rm(f, { force: true })));
    }
  };

  let disposing: Promise<void> | null = null;
  const disposeFamily = (): Promise<void> =>
    (disposing ??= (async () => {
      try {
        if (premium) {
          const res = await parent.request.delete("/api/dev/subscription", {
            headers: e2eSetupHeaders(),
          });
          if (res.status() !== 200 && res.status() !== 404) {
            warn(`E2E用の解約に失敗しました（status=${res.status()}）`);
          }
        }

        const del = await parent.request.delete("/api/account", {
          headers: getBypassHeaders(),
          data: { confirm: "削除します" },
        });
        const status = del.status();
        if (status === 200) {
          const body = (await del.json().catch(() => null)) as { scope?: string } | null;
          if (body?.scope !== "family") {
            warn(`家族ごとの削除になりませんでした（scope=${body?.scope}）`);
          }
        } else if (status !== 401 && status !== 404) {
          warn(`家族の削除に失敗しました（status=${status}）`);
        }
      } catch (e) {
        warn(`家族の後片付け中に例外が発生しました: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        await closeSessions();
      }
    })());

  return {
    parent,
    child: childSession,
    childId: family.childId,
    disposeFamily,
    closeSessions,
  };
}
