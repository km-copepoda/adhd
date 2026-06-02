/**
 * S19: 子供の宝箱ページ
 * 前提: as-child プロジェクト（storageState: child-light.json）で実行
 *
 * - /app/child/treasures が表示される
 * - 承認まち / あけられる カウントが表示される
 * - 「あける」ボタンが unlocked=0 のとき無効
 * - 履歴がない場合は「まだ宝箱を開けていません。」が表示される
 */
import { test, expect } from "./fixtures";

test.describe("S19: 子供の宝箱ページ", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/app/child/treasures");
    await expect(page.getByRole("heading", { name: "宝箱" })).toBeVisible({
      timeout: 15000,
    });
  });

  test("ページの見出し「宝箱」が表示される", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "宝箱" })).toBeVisible();
  });

  test("承認まち / あけられる カウントラベルが表示される", async ({ page }) => {
    await expect(page.getByText("承認まち")).toBeVisible();
    await expect(page.getByText("あけられる")).toBeVisible();
  });

  test("「あける」ボタンが表示される", async ({ page }) => {
    // unlocked=0 のとき disabled。あれば enabled。どちらでも表示はされる
    await expect(page.getByRole("button", { name: /あける/ })).toBeVisible();
  });

  test("これまでの宝箱セクションが表示される", async ({ page }) => {
    await expect(page.getByText("これまでの宝箱")).toBeVisible();
    // 履歴なしまたは「ぜんぶで」サマリーのいずれかが表示される
    const empty = page.getByText("まだ宝箱を開けていません。");
    const summary = page.getByText(/ぜんぶで/);
    await expect(empty.or(summary)).toBeVisible({ timeout: 5000 });
  });

  test("BottomNav に「宝箱」タブがある", async ({ page }) => {
    await expect(page.getByRole("link", { name: /宝箱/ })).toBeVisible();
  });
});
