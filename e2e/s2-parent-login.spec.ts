/**
 * S2: 親ログインフロー
 * - フォーム要素の表示確認
 * - 正常ログイン → /app/parent/tasks に遷移
 * - 境界値: 未入力・誤パスワードでエラー表示
 */
import { test, expect } from "./fixtures";

test.describe("S2: 親ログイン", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/app/parent/login");
  });

  test("ログインフォームが表示される", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /QuestBoard/i })).toBeVisible();
    await expect(page.getByText("ギルドマスター ログイン")).toBeVisible();
    await expect(page.locator('input[placeholder="メールアドレス"]')).toBeVisible();
    await expect(page.locator('input[placeholder="パスワード"]')).toBeVisible();
    await expect(page.getByRole("button", { name: /ログイン/ })).toBeVisible();
  });

  test("正常ログイン → /app/parent/tasks に遷移する", async ({ page }) => {
    await page.fill('input[placeholder="メールアドレス"]', "qb@example.com");
    await page.fill('input[placeholder="パスワード"]', "password");
    await page.click('button:has-text("ログイン")');
    await expect(page).toHaveURL(/\/parent\/tasks/, { timeout: 15000 });
  });

  test("境界値: メールアドレス未入力でもsubmitは実行されない（HTML5バリデーション）", async ({ page }) => {
    await page.fill('input[placeholder="パスワード"]', "password");
    await page.click('button:has-text("ログイン")');
    // ページは /app/parent/tasks に遷移しない
    await expect(page).not.toHaveURL(/\/parent\/tasks/);
  });

  test("境界値: 誤パスワードでエラーメッセージが表示される", async ({ page }) => {
    await page.fill('input[placeholder="メールアドレス"]', "qb@example.com");
    await page.fill('input[placeholder="パスワード"]', "wrongpassword");
    await page.click('button:has-text("ログイン")');
    // エラーメッセージが表示される
    await expect(page.locator("p.text-red-400")).toBeVisible({ timeout: 10000 });
  });

  test("境界値: 存在しないメールアドレスでエラーメッセージが表示される", async ({ page }) => {
    await page.fill('input[placeholder="メールアドレス"]', "nonexistent@example.com");
    await page.fill('input[placeholder="パスワード"]', "password");
    await page.click('button:has-text("ログイン")');
    await expect(page.locator("p.text-red-400")).toBeVisible({ timeout: 10000 });
  });

  test("アカウント作成リンクが表示される", async ({ page }) => {
    await expect(page.getByText("アカウントを作成する")).toBeVisible();
  });
});
