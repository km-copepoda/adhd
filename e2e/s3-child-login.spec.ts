/**
 * S3: 子供ログインフロー（親が発行するワンタイムのログインコード）
 * - フォーム要素の表示確認（入力欄は「ログインコード」1つ）
 * - 親が発行したコードでログイン → /app/child/quests に遷移
 * - 小文字・全角入力でも正規化されてログインできる
 * - 境界値: 存在しないコード・7文字のコードでエラー
 * - 1回限り: 一度使ったコードは別端末では使えない
 *
 * このspecは no-auth プロジェクトで setup より前に走るため、QA 共通アカウントは使えない。
 * 専用の親アカウントを新規登録し、その親セッションでコードを発行する。
 */
import type { BrowserContext } from "@playwright/test";
import { test, expect } from "./fixtures";
import {
  createBrowserContext,
  getBypassHeaders,
  issueChildLoginCode,
  submitChildLoginCode,
} from "./credentials";

let parentCtx: BrowserContext;
let childId: string;

test.describe("S3: 子供ログイン", () => {
  test.beforeAll(async ({ browser }) => {
    const { context, page } = await createBrowserContext(browser);
    parentCtx = context;

    const now = new Date();
    const ts = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
      String(now.getHours()).padStart(2, "0"),
      String(now.getMinutes()).padStart(2, "0"),
      String(now.getSeconds()).padStart(2, "0"),
    ].join("");
    await page.goto("/app/register");
    await expect(page.getByText("管理者 アカウント作成")).toBeVisible({ timeout: 15000 });
    await page.fill('input[placeholder="メールアドレス"]', `QA_S3_${ts}@example.com`);
    await page.fill('input[placeholder="パスワード（6文字以上）"]', "QAPassword123");
    await page.click('button:has-text("アカウントを作成")');
    await page.waitForURL("**/app/parent/tasks", { timeout: 30000 });

    const childRes = await page.request.post("/api/family/members", {
      data: { monsterName: "QA_S3_child", side: "LIGHT" },
      headers: getBypassHeaders(),
    });
    childId = (await childRes.json()).id;
  });

  test.afterAll(async () => {
    await parentCtx?.close();
  });

  test("ログインフォームが表示される（入力欄はログインコード1つ）", async ({ page }) => {
    await page.goto("/app/child/login");
    await expect(page.getByText("ようこそ、冒険者よ！")).toBeVisible();
    await expect(page.getByText("ログインコード")).toBeVisible();
    await expect(page.getByText("ファミリーコード")).not.toBeVisible();
    await expect(page.getByText("ユーザーコード")).not.toBeVisible();
    await expect(page.locator('input[placeholder="ABCD2345"]')).toBeVisible();
    await expect(page.getByRole("button", { name: /ログイン/ })).toBeVisible();
  });

  test("親が発行したコードでログイン → /app/child/quests に遷移する", async ({ page }) => {
    const code = await issueChildLoginCode(parentCtx.request, childId);
    await submitChildLoginCode(page, code);
    await expect(page).toHaveURL(/\/child\/quests/, { timeout: 15000 });
  });

  test("小文字・全角・区切り入りで入力しても正規化されてログインできる", async ({ page }) => {
    const code = await issueChildLoginCode(parentCtx.request, childId);
    const messy = `${code.slice(0, 4)}-${code.slice(4)}`.toLowerCase();
    await submitChildLoginCode(page, messy);
    await expect(page).toHaveURL(/\/child\/quests/, { timeout: 15000 });
  });

  test("境界値: 存在しないコードでエラーが表示される", async ({ page }) => {
    await submitChildLoginCode(page, "AAAAAAAA");
    await expect(page.locator("p.text-red-400")).toBeVisible({ timeout: 10000 });
    await expect(page).not.toHaveURL(/\/child\/quests/);
  });

  test("境界値: 7文字のコードは送信されずエラーが表示される", async ({ page }) => {
    await submitChildLoginCode(page, "ABCD234");
    await expect(page.locator("p.text-red-400")).toBeVisible();
    await expect(page).not.toHaveURL(/\/child\/quests/);
  });

  test("境界値: コード未入力でログインできない", async ({ page }) => {
    await page.goto("/app/child/login");
    await page.click('button:has-text("ログイン")');
    await expect(page.locator("p.text-red-400")).toBeVisible();
    await expect(page).not.toHaveURL(/\/child\/quests/);
  });

  test("1回限り: 一度使ったコードは別の端末では使えない", async ({ page, browser }) => {
    const code = await issueChildLoginCode(parentCtx.request, childId);
    await submitChildLoginCode(page, code);
    await expect(page).toHaveURL(/\/child\/quests/, { timeout: 15000 });

    const { context, page: otherPage } = await createBrowserContext(browser);
    try {
      await submitChildLoginCode(otherPage, code);
      await expect(otherPage.locator("p.text-red-400")).toBeVisible({ timeout: 10000 });
      await expect(otherPage).not.toHaveURL(/\/child\/quests/);
    } finally {
      await context.close();
    }
  });
});
