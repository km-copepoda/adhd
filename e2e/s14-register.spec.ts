/**
 * S14: アカウント登録フォーム境界値テスト
 * 前提: no-auth プロジェクトで実行（未認証状態）
 *
 * - 登録フォームが正しく表示される
 * - 境界値: メール未入力ではsubmitできない（HTML5バリデーション）
 * - 境界値: パスワードが5文字以下では作成ボタンが無効（minLength=6）
 * - 境界値: メール形式が不正ではsubmitできない（HTML5バリデーション）
 * - ログインページへのリンクが表示される
 *
 * ※ 実際のアカウント作成は auth.setup.ts で検証済みのため、
 *   このテストはフォームのバリデーション動作のみを確認する。
 */
import { test, expect } from "./fixtures";

test.describe("S14: アカウント登録フォーム", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/app/register");
  });

  test("登録フォームが正しく表示される", async ({ page }) => {
    await expect(page.getByText("ギルドマスター アカウント作成")).toBeVisible();
    await expect(page.locator('input[placeholder="メールアドレス"]')).toBeVisible();
    await expect(page.locator('input[placeholder="パスワード（6文字以上）"]')).toBeVisible();
    await expect(page.getByRole("button", { name: /アカウントを作成/ })).toBeVisible();
  });

  test("ログインページへのリンクが表示される", async ({ page }) => {
    await expect(page.getByText(/すでにアカウントをお持ちの方/)).toBeVisible();
    const loginLink = page.getByRole("link", { name: /すでにアカウントをお持ちの方/ });
    await expect(loginLink).toHaveAttribute("href", /parent\/login/);
  });

  test("境界値: メール未入力では HTML5 バリデーションで送信できない", async ({ page }) => {
    await page.fill('input[placeholder="パスワード（6文字以上）"]', "password123");
    // submit は JavaScript ハンドラ経由なので、required が効くか確認
    const emailInput = page.locator('input[placeholder="メールアドレス"]');
    const validity = await emailInput.evaluate(
      (el: HTMLInputElement) => el.validity.valueMissing,
    );
    expect(validity).toBe(true);
  });

  test("境界値: パスワード 5 文字以下では minLength 違反になる", async ({ page }) => {
    await page.fill('input[placeholder="メールアドレス"]', "test@example.com");
    await page.fill('input[placeholder="パスワード（6文字以上）"]', "12345");
    const passwordInput = page.locator('input[placeholder="パスワード（6文字以上）"]');
    const validity = await passwordInput.evaluate(
      (el: HTMLInputElement) => el.validity.tooShort,
    );
    expect(validity).toBe(true);
  });

  test("境界値: 不正なメール形式では HTML5 バリデーション違反になる", async ({ page }) => {
    await page.fill('input[placeholder="メールアドレス"]', "not-an-email");
    const emailInput = page.locator('input[placeholder="メールアドレス"]');
    const validity = await emailInput.evaluate(
      (el: HTMLInputElement) => el.validity.typeMismatch,
    );
    expect(validity).toBe(true);
  });
});
