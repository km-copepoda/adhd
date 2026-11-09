/**
 * S31: ログアウトと再ログイン（Issue #224）
 * 前提: as-parent-premium プロジェクト（dependencies: ["setup"] は Vercel クッキーのコピー元 parent.json のために必要）。
 *
 * - signOut() は global スコープなので、共有の parent.json / child-light.json ではログアウトしない。
 *   ここでは createFreshFamily で作った専用の家族の親・子だけを使う。
 * - 子のログインは「親が発行するワンタイムのログインコード」方式（#184）。
 *   「同じコードで再ログイン」ではなく、使用済みコードは拒否され、新しいコードなら再ログインできる。
 * - 子のログインには IP ごとのレート制限があるため、ログイン送信は最小限（初回・使用済みコードの再利用・再ログインの 3 回）。
 */
import type { BrowserContext, Page } from "@playwright/test";
import { test, expect } from "./fixtures";
import { createBrowserContext, getBypassHeaders, issueChildLoginCode, submitChildLoginCode } from "./credentials";
import { createAnonymousContext } from "./helpers/authGuard";
import { createFreshFamily, type FreshFamily } from "./helpers/freshFamily";

let family: FreshFamily;

test.beforeAll(async ({ browser }) => {
  family = await createFreshFamily(browser);
});

test.describe("S31: 親のログアウト", () => {
  let ctx: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    ({ context: ctx, page } = await createBrowserContext(browser, family.parentStatePath));
  });
  test.afterAll(async () => {
    await ctx?.close();
  });

  test("ログアウト -> /login。保護ページはログイン画面へ、API は 401。戻る -> 再読み込みでもログイン画面", async () => {
    await page.goto("/app/parent/tasks");
    await page.goto("/app/parent/family");
    await page.getByRole("button", { name: /ログアウト/ }).click();
    await expect(page).toHaveURL(/\/login$/, { timeout: 15000 });

    await test.step("保護ページはログイン画面にリダイレクトされる", async () => {
      await page.goto("/app/parent/tasks");
      await expect(page).toHaveURL(/\/app\/parent\/login$/);
    });

    await test.step("同じコンテキストの API は 401", async () => {
      const res = await ctx.request.get("/api/parent/child-view/children", { headers: getBypassHeaders() });
      expect(res.status()).toBe(401);
    });

    await test.step("戻る -> 再読み込みでログイン画面にリダイレクトされる", async () => {
      // bfcache で前の画面が一瞬見えることがあるため、goBack の後に reload して確かめる
      await page.goBack();
      await page.reload();
      await expect(page).toHaveURL(/\/app\/parent\/login$|\/login$/);
      await expect(page).not.toHaveURL(/\/app\/parent\/(tasks|family)$/);
    });
  });
});

test.describe("S31: 子のログアウトと再ログイン", () => {
  test.describe.configure({ mode: "serial" });

  let parentCtx: BrowserContext;
  let childCtx: BrowserContext;
  let childPage: Page;
  let usedCode: string;

  test.beforeAll(async ({ browser }) => {
    ({ context: parentCtx } = await createBrowserContext(browser, family.parentStatePath));
    ({ context: childCtx, page: childPage } = await createAnonymousContext(browser));
  });
  test.afterAll(async () => {
    await parentCtx?.close();
    await childCtx?.close();
  });

  test("新しい子でログインし、育成画面に入れる", async () => {
    usedCode = await issueChildLoginCode(parentCtx.request, family.childId);
    await submitChildLoginCode(childPage, usedCode);
    await childPage.waitForURL("**/app/child/quests", { timeout: 15000 });
    await childPage.goto("/app/child/monster");
    await expect(childPage).toHaveURL(/\/app\/child\/monster$/);
  });

  test("confirm をキャンセルするとログイン状態のまま育成画面にとどまる", async () => {
    childPage.once("dialog", (d) => void d.dismiss());
    await childPage.getByRole("button", { name: /ログアウト/ }).click();
    await expect(childPage).toHaveURL(/\/app\/child\/monster$/);
    const res = await childCtx.request.get("/api/family/code", { headers: getBypassHeaders() });
    const data = (await res.json()) as { members: { id: string }[] };
    expect(data.members.map((m) => m.id)).toEqual([family.childId]);
  });

  test("confirm を OK にすると /login へ。保護ページは /login へ、API はデータを返さない", async () => {
    childPage.once("dialog", (d) => void d.accept());
    await childPage.getByRole("button", { name: /ログアウト/ }).click();
    await expect(childPage).toHaveURL(/\/login$/, { timeout: 15000 });

    await test.step("保護ページは /login にリダイレクトされる", async () => {
      await childPage.goto("/app/child/quests");
      await expect(childPage).toHaveURL(/\/login$/);
    });

    await test.step("GET /api/quests/today は 200 で空", async () => {
      const res = await childCtx.request.get("/api/quests/today", { headers: getBypassHeaders() });
      expect(res.status()).toBe(200);
      expect(await res.json()).toEqual([]);
    });

    await test.step("戻る -> 再読み込みでログイン画面にリダイレクトされる", async () => {
      await childPage.goBack();
      await childPage.reload();
      await expect(childPage).toHaveURL(/\/login$/);
    });
  });

  test("使用済みのログインコードは再利用できず、ログイン画面にとどまる", async () => {
    await submitChildLoginCode(childPage, usedCode);
    await expect(childPage.getByText("コードが正しくありません")).toBeVisible({ timeout: 15000 });
    await expect(childPage).toHaveURL(/\/app\/child\/login$/);
  });

  test("親が新しいコードを発行すれば再ログインできる", async () => {
    const newCode = await issueChildLoginCode(parentCtx.request, family.childId);
    expect(newCode).not.toBe(usedCode);
    await submitChildLoginCode(childPage, newCode);
    await childPage.waitForURL("**/app/child/quests", { timeout: 15000 });
  });
});
