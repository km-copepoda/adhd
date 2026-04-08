/**
 * S1: ランディングページ → ロール選択
 * - /login（ログイン選択画面）が正しく表示される
 * - 子供ボタン → /app/child/login に遷移
 * - 親ボタン → /app/parent/login に遷移
 * - / (LP) はリダイレクトされない
 */
import { test, expect } from "./fixtures";

test.describe("S1: ランディングページ", () => {
  test.describe("/login ページ", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/login");
    });

    test("タイトルと主要要素が表示される", async ({ page }) => {
      await expect(page.getByRole("heading", { name: /QuestBoard/i })).toBeVisible();
      await expect(page.getByRole("link", { name: /ぼうけんをはじめる/ })).toBeVisible();
      await expect(page.getByRole("link", { name: /ギルドマスター/ })).toBeVisible();
    });

    test("子供ボタンから /app/child/login に遷移する", async ({ page }) => {
      await page.click('a:has-text("ぼうけんをはじめる")');
      await expect(page).toHaveURL(/\/app\/child\/login/);
    });

    test("親ボタンから /app/parent/login に遷移する", async ({ page }) => {
      await page.click('a:has-text("ギルドマスター")');
      await expect(page).toHaveURL(/\/app\/parent\/login/);
    });
  });

  test.describe("/ (LP) ページ", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/");
    });

    test("/ にアクセスしてもリダイレクトされない", async ({ page }) => {
      await expect(page).not.toHaveURL(/\/app\/child\/login|\/app\/parent\/login/);
      await expect(page).toHaveURL(/\/$/);
    });

    test("LP のヒーローセクションが表示される", async ({ page }) => {
      await expect(page.getByRole("heading", { name: /QuestBoard/i, level: 1 })).toBeVisible();
      await expect(page.getByRole("link", { name: /冒険をはじめる/ })).toBeVisible();
    });

    test("LP から /login に遷移できる", async ({ page }) => {
      await page.click('a:has-text("冒険をはじめる")');
      await expect(page).toHaveURL(/\/login/);
    });
  });
});
