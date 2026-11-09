/**
 * S29: 認証・ロールごとのページ遷移ガード（Issue #224）
 * 前提: as-parent-premium プロジェクト（parent.json / child-light.json は読むだけ。ログアウトしない）。
 *
 * - HTTP レベル: maxRedirects: 0 で 307 と Location のパス（または 200 / 404）を検証する
 * - 画面レベル: 未認証・親・子それぞれ代表ケースで最終 URL と見出しを検証する
 * - 期待値は現在のミドルウェア（src/lib/supabase/middleware.ts）の挙動を仕様とする（Q1: A）
 *   例: 親が /app/child/login → 親のホーム、子が /app/parent/login → 子のホーム
 * - 壊れた認証クッキー: 未認証と同じ扱いで、500 にもリダイレクトのループにもならない
 */
import type { APIRequestContext, BrowserContext, Page } from "@playwright/test";
import path from "path";
import { test, expect } from "./fixtures";
import { AUTH_DIR, createBrowserContext, getBypassHeaders } from "./credentials";
import { createAnonymousContext, createBrokenSessionContext } from "./helpers/authGuard";

type Role = "anon" | "parent" | "child";
/** "ok" = そのまま表示（200）、"404" = 404 ページ、それ以外 = 307 のリダイレクト先パス */
type Expected = "ok" | "404" | string;

const PARENT_HOME = "/app/parent/tasks";
const CHILD_HOME = "/app/child/quests";

// [パス, 未認証, 親, 子]
const MATRIX: Array<[string, Expected, Expected, Expected]> = [
  ["/", "ok", "ok", "ok"],
  ["/login", "ok", PARENT_HOME, CHILD_HOME],
  ["/app/parent/login", "ok", "ok", CHILD_HOME],
  ["/app/child/login", "ok", PARENT_HOME, "ok"],
  ["/app/register", "ok", "ok", "ok"],
  ["/app/parent/tasks", "/app/parent/login", "ok", CHILD_HOME],
  ["/app/parent/approve", "/app/parent/login", "ok", CHILD_HOME],
  // 親の画面だがパスに "child" を含む。親のプレフィックス判定が効いて子は子のホームへ戻される
  ["/app/parent/child-view", "/app/parent/login", "ok", CHILD_HOME],
  ["/app/child/quests", "/login", PARENT_HOME, "ok"],
  ["/app/child/monster", "/login", PARENT_HOME, "ok"],
  // 旧パス（廃止済み）。未認証は /login、ログイン済みは 404
  ["/parent/tasks", "/login", "404", "404"],
  ["/child/quests", "/login", "404", "404"],
  ["/register", "/login", "404", "404"],
];

const ROLES: Role[] = ["anon", "parent", "child"];

let ctxs: Record<Role, BrowserContext>;

test.beforeAll(async ({ browser }) => {
  const anon = await createAnonymousContext(browser);
  const parent = await createBrowserContext(browser, path.join(AUTH_DIR, "parent.json"));
  const child = await createBrowserContext(browser, path.join(AUTH_DIR, "child-light.json"));
  ctxs = { anon: anon.context, parent: parent.context, child: child.context };
});

test.afterAll(async () => {
  await Promise.all(Object.values(ctxs ?? {}).map((c) => c.close()));
});

/** リダイレクトを追わずに GET し、307 と Location のパス、または 200 / 404 を検証する */
async function expectGuard(req: APIRequestContext, pathname: string, expected: Expected) {
  const res = await req.get(pathname, { maxRedirects: 0, headers: getBypassHeaders() });
  if (expected === "ok") {
    expect(res.status(), `${pathname} は表示される`).toBe(200);
  } else if (expected === "404") {
    expect(res.status(), `${pathname} は 404`).toBe(404);
  } else {
    expect(res.status(), `${pathname} は 307`).toBe(307);
    const location = res.headers()["location"];
    expect(location, "Location ヘッダーがある").toBeTruthy();
    expect(new URL(location, "http://localhost").pathname).toBe(expected);
  }
}

test.describe("S29: ページ遷移ガード（HTTP レベル）", () => {
  for (const [pathname, anon, parent, child] of MATRIX) {
    const row: Record<Role, Expected> = { anon, parent, child };
    for (const role of ROLES) {
      test(`${role}: ${pathname} → ${row[role]}`, async () => {
        await expectGuard(ctxs[role].request, pathname, row[role]);
      });
    }
  }
});

test.describe("S29: 境界値（末尾スラッシュ・プレフィックス）", () => {
  // 末尾スラッシュは Next.js が 308 で正規化することがあるため、リダイレクトを追った最終 URL で比べる
  const CASES: Array<[Role, string, string]> = [
    ["anon", "/app/parent", "/app/parent/login"],
    ["anon", "/app/parent/", "/app/parent/login"],
    ["anon", "/app/child", "/login"],
    ["anon", "/app/child/", "/login"],
    ["child", "/app/parent", CHILD_HOME],
    ["child", "/app/parent/", CHILD_HOME],
    ["parent", "/app/child", PARENT_HOME],
    ["parent", "/app/child/", PARENT_HOME],
  ];
  for (const [role, pathname, finalPath] of CASES) {
    test(`${role}: ${pathname} の最終到達先は ${finalPath}`, async () => {
      const res = await ctxs[role].request.get(pathname, { headers: getBypassHeaders() });
      expect(res.status()).toBe(200);
      expect(new URL(res.url()).pathname).toBe(finalPath);
    });
  }

  test("ログイン済みの親・子で / は LP のまま（リダイレクトされない）", async () => {
    for (const role of ["parent", "child"] as const) {
      const res = await ctxs[role].request.get("/", { maxRedirects: 0, headers: getBypassHeaders() });
      expect(res.status(), `${role} の / は 200`).toBe(200);
    }
  });
});

test.describe("S29: 画面レベル", () => {
  let page: Page;
  test.afterEach(async () => {
    await page?.close();
  });

  test("未認証: /app/parent/tasks → 親ログイン画面（見出しまで表示）", async () => {
    page = await ctxs.anon.newPage();
    await page.goto("/app/parent/tasks");
    await expect(page).toHaveURL(/\/app\/parent\/login$/);
    await expect(page.getByRole("heading", { name: /QuestBoard/ })).toBeVisible();
    await expect(page.getByText("管理者 ログイン")).toBeVisible();
  });

  test("未認証: /app/child/quests → /login（ログイン選択画面）", async () => {
    page = await ctxs.anon.newPage();
    await page.goto("/app/child/quests");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("link", { name: /ぼうけんをはじめる/ })).toBeVisible();
  });

  test("親: /login → /app/parent/tasks（タスク管理）", async () => {
    page = await ctxs.parent.newPage();
    await page.goto("/login");
    await expect(page).toHaveURL(/\/app\/parent\/tasks$/);
    await expect(page.getByRole("heading", { name: /タスク管理/ })).toBeVisible();
  });

  test("親: /app/child/login → 親のホーム（今の挙動が仕様）", async () => {
    page = await ctxs.parent.newPage();
    await page.goto("/app/child/login");
    await expect(page).toHaveURL(/\/app\/parent\/tasks$/);
    await expect(page.getByRole("heading", { name: /タスク管理/ })).toBeVisible();
  });

  test("子: /login → /app/child/quests（今日のクエスト）", async () => {
    page = await ctxs.child.newPage();
    await page.goto("/login");
    await expect(page).toHaveURL(/\/app\/child\/quests$/);
    await expect(page.getByRole("heading", { name: /今日のクエスト/ })).toBeVisible();
  });

  test("子: /app/parent/child-view → 子のホームに戻される", async () => {
    page = await ctxs.child.newPage();
    await page.goto("/app/parent/child-view");
    await expect(page).toHaveURL(/\/app\/child\/quests$/);
    await expect(page.getByRole("heading", { name: /今日のクエスト/ })).toBeVisible();
  });

  test("ログイン済み: 旧パス /parent/tasks は 404 ページ", async () => {
    page = await ctxs.parent.newPage();
    const res = await page.goto("/parent/tasks");
    expect(res?.status()).toBe(404);
    await expect(page.getByText("ページが見つかりませんでした")).toBeVisible();
  });

  test("未認証: 旧パス /register → /login", async () => {
    page = await ctxs.anon.newPage();
    await page.goto("/register");
    await expect(page).toHaveURL(/\/login$/);
  });
});

test.describe("S29: 壊れた認証クッキー（未認証と同じ扱い・500 にならない）", () => {
  let broken: Awaited<ReturnType<typeof createBrokenSessionContext>>;

  test.beforeAll(async ({ browser }) => {
    broken = await createBrokenSessionContext(browser);
  });
  test.afterAll(async () => {
    await broken?.context.close();
  });

  test("壊した sb- クッキーが 1 つ以上ある", () => {
    expect(broken.brokenCookieNames.length).toBeGreaterThan(0);
    expect(broken.brokenCookieNames.every((n) => n.startsWith("sb-"))).toBe(true);
  });

  test("/app/parent/tasks → /app/parent/login（HTTP 307）", async () => {
    await expectGuard(broken.context.request, "/app/parent/tasks", "/app/parent/login");
  });

  test("/app/parent/tasks → 親ログイン画面が表示される", async () => {
    await broken.page.goto("/app/parent/tasks");
    await expect(broken.page).toHaveURL(/\/app\/parent\/login$/);
    await expect(broken.page.getByText("管理者 ログイン")).toBeVisible();
  });

  test("/login → リダイレクトされず（ループせず）ログイン選択画面が表示される", async () => {
    await expectGuard(broken.context.request, "/login", "ok");
    await broken.page.goto("/login");
    await expect(broken.page).toHaveURL(/\/login$/);
    await expect(broken.page.getByRole("link", { name: /ぼうけんをはじめる/ })).toBeVisible();
  });

  test("GET /api/parent/child-view/children → 401（500 にならない）", async () => {
    const res = await broken.context.request.get("/api/parent/child-view/children", {
      headers: getBypassHeaders(),
    });
    expect(res.status()).toBe(401);
    expect(res.headers()["content-type"]).toContain("application/json");
  });
});
