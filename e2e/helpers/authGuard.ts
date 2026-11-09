/**
 * 認証ガード検証用ヘルパー（Issue #224）
 */
import fs from "fs";
import path from "path";
import type { Browser, BrowserContext, Page } from "@playwright/test";
import { getE2EBaseUrl, getE2EHostname, getE2ERoutePattern } from "../baseUrl";
import { AUTH_DIR } from "../credentials";

type StoredCookie = {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite: "Strict" | "Lax" | "None";
};
type StoredState = { cookies?: StoredCookie[]; origins?: unknown[] };

const PARENT_STATE = path.join(AUTH_DIR, "parent.json");

function readState(file: string): StoredState {
  return JSON.parse(fs.readFileSync(file, "utf-8")) as StoredState;
}

function isVercelCookie(c: StoredCookie): boolean {
  return (
    (c.domain.includes(getE2EHostname()) ||
      c.domain.includes(".vercel.app") ||
      c.domain.includes("vercel.com")) &&
    !c.name.startsWith("sb-")
  );
}

/**
 * Vercel ドメインにだけ bypass ヘッダーを付ける（全オリジンに extraHTTPHeaders を付けると Supabase 等の CORS が壊れる）。
 * ページ単位ではなくコンテキスト単位で route を張るので、後から newPage() したページにも効く。
 */
async function setupContextBypassRoute(context: BrowserContext): Promise<void> {
  const secret = process.env.VERCEL_BYPASS_SECRET;
  if (!secret) return;
  await context.route(getE2ERoutePattern(), async (route) => {
    await route.continue({
      headers: { ...route.request().headers(), "x-vercel-protection-bypass": secret },
    });
  });
}

export type BrokenSession = {
  context: BrowserContext;
  page: Page;
  /** 壊した sb- 始まりの認証クッキーの名前（チャンク分割された .0 / .1 を含む） */
  brokenCookieNames: string[];
};

/**
 * 読んだ storageState（既定は共有の parent.json）をコピーし、`sb-` で始まる認証クッキーの値を
 * すべて "broken" に置き換えたコンテキストを作る。Vercel 保護のクッキーはそのまま残す。
 * 元のファイルは書き換えない。壊すクッキーが 1 つも無ければ throw する（skip しない）。
 */
export async function createBrokenSessionContext(
  browser: Browser,
  sourceStatePath: string = PARENT_STATE,
): Promise<BrokenSession> {
  const state = readState(sourceStatePath);
  const brokenCookieNames: string[] = [];
  const cookies = (state.cookies ?? []).map((c) => {
    if (!c.name.startsWith("sb-")) return c;
    brokenCookieNames.push(c.name);
    return { ...c, value: "broken" };
  });
  if (brokenCookieNames.length === 0) {
    throw new Error(`壊せる sb- クッキーがありません（${sourceStatePath}）`);
  }
  // ファイルは書き換えず、メモリ上のコピーを storageState に渡す
  const context = await browser.newContext({
    baseURL: getE2EBaseUrl(),
    storageState: { cookies, origins: [] },
  });
  await setupContextBypassRoute(context);
  const page = await context.newPage();
  return { context, page, brokenCookieNames };
}

/**
 * 未認証（アプリのセッションなし）の新しいコンテキストを返す。Vercel 保護のクッキーだけ持つ。
 *
 * createBrowserContext(browser)（storageState なし）は、as-parent-premium のように project の
 * `use.storageState` が設定されている project では、そのログイン状態を引き継いでしまう
 * （テスト用 fixture の browser.newContext は project の use を継承するため）。
 * その project で「未認証」「新しい子の端末」を作るにはこのヘルパーを使う。
 * 実装方針: storageState に `{ cookies: [], origins: [] }` を明示して継承を打ち消し、
 * その後 parent.json から Vercel のクッキー（sb- 以外）だけをコピーする（createBrowserContext と同じ）。
 * bypass ヘッダーは route 方式（Vercel ホストだけ）で付ける。
 * 作成直後に sb- で始まるクッキーが 0 件であることを保証する（あれば throw）。
 */
export async function createAnonymousContext(
  browser: Browser,
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({
    baseURL: getE2EBaseUrl(),
    storageState: { cookies: [], origins: [] },
  });
  if (fs.existsSync(PARENT_STATE)) {
    const vercelCookies = (readState(PARENT_STATE).cookies ?? []).filter(isVercelCookie);
    if (vercelCookies.length > 0) await context.addCookies(vercelCookies);
  }
  await setupContextBypassRoute(context);
  const leaked = (await context.cookies()).filter((c) => c.name.startsWith("sb-"));
  if (leaked.length > 0) {
    await context.close();
    throw new Error(`未認証コンテキストに sb- クッキーが残っています: ${leaked.map((c) => c.name).join(", ")}`);
  }
  const page = await context.newPage();
  return { context, page };
}
