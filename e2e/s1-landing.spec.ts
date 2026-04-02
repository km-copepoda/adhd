/**
 * S1: ランディングページ → ロール選択
 * - トップが正しく表示される
 * - 子供ボタン → /child/login に遷移
 * - 親ボタン → /parent/login に遷移
 */
import { test, expect } from "@playwright/test";

test.describe("S1: ランディングページ", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("タイトルと主要要素が表示される", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /QuestBoard/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /ぼうけんをはじめる/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /ギルドマスター/ })).toBeVisible();
  });

  test("子供ボタンから /child/login に遷移する", async ({ page }) => {
    await page.click('a:has-text("ぼうけんをはじめる")');
    await expect(page).toHaveURL(/\/child\/login/);
  });

  test("親ボタンから /parent/login に遷移する", async ({ page }) => {
    await page.click('a:has-text("ギルドマスター")');
    await expect(page).toHaveURL(/\/parent\/login/);
  });

  test("/ にアクセスすると /child/login や /parent/login にリダイレクトされない", async ({ page }) => {
    await expect(page).toHaveURL(/^\/?$/);
  });
});
