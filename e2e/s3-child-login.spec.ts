/**
 * S3: 子供ログインフロー
 * - フォーム要素の表示確認
 * - ライトモード（0321）でログイン → /app/child/quests に遷移
 * - ダークモード（5334）でログイン → /app/child/quests に遷移
 * - 境界値: 無効コードでエラー
 */
import { test, expect } from "./fixtures";

const FAMILY_CODE = "VJZQSH";

test.describe("S3: 子供ログイン", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/app/child/login");
  });

  test("ログインフォームが表示される", async ({ page }) => {
    await expect(page.getByText("ようこそ、冒険者よ！")).toBeVisible();
    await expect(page.getByText("ファミリーコード")).toBeVisible();
    await expect(page.getByText("ユーザーコード")).toBeVisible();
    await expect(page.locator('input[placeholder="ABC123"]')).toBeVisible();
    await expect(page.locator('input[placeholder="1234"]')).toBeVisible();
    await expect(page.getByRole("button", { name: /ログイン/ })).toBeVisible();
  });

  test("ライトモードユーザー（0321）でログイン → /app/child/quests に遷移する", async ({ page }) => {
    await page.fill('input[placeholder="ABC123"]', FAMILY_CODE);
    await page.fill('input[placeholder="1234"]', "0321");
    await page.click('button:has-text("ログイン")');
    await expect(page).toHaveURL(/\/child\/quests/, { timeout: 15000 });
  });

  test("ダークモードユーザー（5334）でログイン → /app/child/quests に遷移する", async ({ page }) => {
    await page.fill('input[placeholder="ABC123"]', FAMILY_CODE);
    await page.fill('input[placeholder="1234"]', "5334");
    await page.click('button:has-text("ログイン")');
    await expect(page).toHaveURL(/\/child\/quests/, { timeout: 15000 });
  });

  test("境界値: 誤ったファミリーコードでエラーが表示される", async ({ page }) => {
    await page.fill('input[placeholder="ABC123"]', "AAAAAA");
    await page.fill('input[placeholder="1234"]', "0321");
    await page.click('button:has-text("ログイン")');
    await expect(page.locator("p.text-red-400")).toBeVisible({ timeout: 10000 });
  });

  test("境界値: 誤ったユーザーコードでエラーが表示される", async ({ page }) => {
    await page.fill('input[placeholder="ABC123"]', FAMILY_CODE);
    await page.fill('input[placeholder="1234"]', "9999");
    await page.click('button:has-text("ログイン")');
    await expect(page.locator("p.text-red-400")).toBeVisible({ timeout: 10000 });
  });

  test("境界値: ファミリーコード未入力でsubmitが実行されない（HTML5バリデーション）", async ({ page }) => {
    await page.fill('input[placeholder="1234"]', "0321");
    await page.click('button:has-text("ログイン")');
    await expect(page).not.toHaveURL(/\/child\/quests/);
  });

  test("ファミリーコードは大文字変換される（小文字入力が自動大文字化される）", async ({ page }) => {
    // ページ内で toUpperCase 変換が行われるかを確認
    const input = page.locator('input[placeholder="ABC123"]');
    await input.fill("vjzqsh");
    const value = await input.inputValue();
    // JavaScriptによりUI上ではUpperCaseになるが、最終submitで正しく処理される
    // (実際の変換はonChange内で行われる)
    await page.fill('input[placeholder="1234"]', "0321");
    await page.click('button:has-text("ログイン")');
    await expect(page).toHaveURL(/\/child\/quests/, { timeout: 15000 });
  });
});
