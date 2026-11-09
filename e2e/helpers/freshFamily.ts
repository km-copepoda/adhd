/**
 * 専用の新しい家族を作るヘルパー（Issue #224）
 *
 * ログアウト（signOut は global スコープ）や子のログイン（child-rejoin が supabaseId を付け替える）は、
 * 共有の parent.json / child-light.json を壊すため、破壊的な検証は必ずここで作った家族で行う。
 *
 * 手順（auth.setup.ts の 1〜2 と同じ。auth.setup.ts 自体は変更しない）:
 *   1. createAnonymousContext(browser) で /app/register から QA_auth_<timestamp>@example.com の親を登録
 *   2. POST /api/family/members で子を1人作る（PREMIUM 化はしない）
 *      ※ 未認証コンテキストは createBrowserContext(browser) ではなく createAnonymousContext で作る
 *        （前者は as-parent-premium では project の storageState を引き継ぐため）
 *   3. 親の storageState を playwright/.auth/ 配下に保存する（親のセッションは parentStatePath から開き直せる）
 *
 * 子のログインはここでは行わない。呼び出し側が issueChildLoginCode / submitChildLoginCode で
 * 必要最小限の回数だけ行う（child-rejoin には IP ごとのレート制限がある）。
 *
 * 後片付け: 作った家族・Supabase ユーザーは削除しない（削除 API が無いため。auth.setup と同じ運用）。
 */
import fs from "fs";
import path from "path";
import { expect, type Browser } from "@playwright/test";
import { AUTH_DIR, getBypassHeaders } from "../credentials";
import { createAnonymousContext } from "./authGuard";

export type FreshFamily = {
  email: string;
  password: string;
  /** 作成した子供の User.id（issueChildLoginCode に渡す） */
  childId: string;
  /** 親の storageState（createBrowserContext(browser, path) / request.newContext({ storageState }) で開く） */
  parentStatePath: string;
};

/** 新しい家族（親1人・子1人）を作り、親のセッションを保存して返す。 */
export async function createFreshFamily(browser: Browser): Promise<FreshFamily> {
  // 同じ秒に複数 spec が作っても衝突しないよう、乱数を足す
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const email = `QA_auth_${suffix}@example.com`;
  const password = "QAPassword123";
  const parentStatePath = path.join(AUTH_DIR, `fresh-family-${suffix}.json`);
  fs.mkdirSync(AUTH_DIR, { recursive: true });

  const { context, page } = await createAnonymousContext(browser);
  try {
    await page.goto("/app/register");
    await expect(page.getByText("管理者 アカウント作成")).toBeVisible({ timeout: 15000 });
    await page.fill('input[placeholder="メールアドレス"]', email);
    await page.fill('input[placeholder="パスワード（6文字以上）"]', password);
    await page.click('button:has-text("アカウントを作成")');
    await page.waitForURL("**/app/parent/tasks", { timeout: 30000 });

    const res = await page.request.post("/api/family/members", {
      data: { monsterName: "QA_auth_child", side: "LIGHT" },
      headers: getBypassHeaders(),
    });
    if (!res.ok()) {
      throw new Error(`子供の作成に失敗しました（status=${res.status()}）`);
    }
    const { id: childId } = (await res.json()) as { id: string };
    await context.storageState({ path: parentStatePath });
    return { email, password, childId, parentStatePath };
  } finally {
    await context.close();
  }
}
