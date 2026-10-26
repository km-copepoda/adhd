import { afterEach, describe, expect, it, vi } from "vitest";
import { createBrowserContext } from "../../../e2e/credentials";
import { getE2ERoutePattern } from "../../../e2e/baseUrl";

/**
 * 想定インターフェース（PR #234 Codex P1 対応）:
 *   createBrowserContext(browser, storageStatePath?, { bypass: "route" })
 * - オプションなし: 従来どおり extraHTTPHeaders で全オリジンに bypass ヘッダーを付ける
 * - bypass: "route": extraHTTPHeaders を付けず、page.route で Vercel ホストにだけ付ける
 *   （Supabase Storage への CORS プリフライトを壊さないため）
 */

const SECRET = "test-secret";

function makeMocks() {
  const page = { route: vi.fn().mockResolvedValue(undefined) };
  const context = {
    newPage: vi.fn().mockResolvedValue(page),
    addCookies: vi.fn().mockResolvedValue(undefined),
  };
  const browser = { newContext: vi.fn().mockResolvedValue(context) };
  return { browser, context, page };
}

// モックは Playwright の Browser 型を満たさないため、引数型だけ Browser に合わせて渡す。
type Args = Parameters<typeof createBrowserContext>;
const create = (
  browser: ReturnType<typeof makeMocks>["browser"],
  storageStatePath?: Args[1],
  options?: Args[2],
) => createBrowserContext(browser as unknown as Args[0], storageStatePath, options);

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("createBrowserContext 既定動作（回帰）", () => {
  it("VERCEL_BYPASS_SECRET 設定時は extraHTTPHeaders を付け、page.route は使わない", async () => {
    vi.stubEnv("VERCEL_BYPASS_SECRET", SECRET);
    const { browser, page } = makeMocks();
    await create(browser, "state.json");
    const arg = browser.newContext.mock.calls[0][0];
    expect(arg.extraHTTPHeaders).toEqual({ "x-vercel-protection-bypass": SECRET });
    expect(page.route).not.toHaveBeenCalled();
  });

  it("境界値: secret 未設定なら extraHTTPHeaders を付けない", async () => {
    vi.stubEnv("VERCEL_BYPASS_SECRET", "");
    const { browser } = makeMocks();
    await create(browser, "state.json");
    expect(browser.newContext.mock.calls[0][0]).not.toHaveProperty("extraHTTPHeaders");
  });
});

describe("createBrowserContext { bypass: 'route' }", () => {
  it("storageState が newContext に渡る", async () => {
    vi.stubEnv("VERCEL_BYPASS_SECRET", SECRET);
    const { browser } = makeMocks();
    await create(browser, "child.json", { bypass: "route" });
    expect(browser.newContext.mock.calls[0][0].storageState).toBe("child.json");
  });

  it("secret 設定時: extraHTTPHeaders を渡さない", async () => {
    vi.stubEnv("VERCEL_BYPASS_SECRET", SECRET);
    const { browser } = makeMocks();
    await create(browser, "child.json", { bypass: "route" });
    expect(browser.newContext.mock.calls[0][0]).not.toHaveProperty("extraHTTPHeaders");
  });

  it("secret 設定時: page.route が Vercel ホストだけのパターンで登録される", async () => {
    vi.stubEnv("VERCEL_BYPASS_SECRET", SECRET);
    const { browser, page } = makeMocks();
    await create(browser, "child.json", { bypass: "route" });
    expect(page.route).toHaveBeenCalledTimes(1);
    expect(page.route.mock.calls[0][0]).toBe(getE2ERoutePattern());
  });

  it("secret 設定時: ハンドラが既存ヘッダーを保って bypass ヘッダーを付け route.continue する", async () => {
    vi.stubEnv("VERCEL_BYPASS_SECRET", SECRET);
    const { browser, page } = makeMocks();
    await create(browser, "child.json", { bypass: "route" });
    const handler = page.route.mock.calls[0][1];
    const route = {
      request: () => ({ headers: () => ({ accept: "text/html" }) }),
      continue: vi.fn().mockResolvedValue(undefined),
    };
    await handler(route);
    expect(route.continue).toHaveBeenCalledWith({
      headers: { accept: "text/html", "x-vercel-protection-bypass": SECRET },
    });
  });

  it("境界値: secret 未設定ならヘッダーも route も付けない", async () => {
    vi.stubEnv("VERCEL_BYPASS_SECRET", "");
    const { browser, page } = makeMocks();
    await create(browser, "child.json", { bypass: "route" });
    expect(browser.newContext.mock.calls[0][0]).not.toHaveProperty("extraHTTPHeaders");
    expect(page.route).not.toHaveBeenCalled();
  });

  it("context と page を返す", async () => {
    vi.stubEnv("VERCEL_BYPASS_SECRET", SECRET);
    const { browser, context, page } = makeMocks();
    const result = await create(browser, "child.json", { bypass: "route" });
    expect(result.context).toBe(context);
    expect(result.page).toBe(page);
  });
});
