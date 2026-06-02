/**
 * S20: 子供のコレクションページ（3タブ）
 * 前提: as-child プロジェクト（storageState: child-light.json）で実行
 *
 * - /app/child/collection が表示される
 * - 📖 図鑑 / 🎁 アイテム / 🏅 実績 の3タブが表示される
 * - デフォルトで図鑑タブが選択される（モンスター図鑑のヘッダーが見える）
 * - アイテムタブを開くとコレクションアイテムのヘッダーとシーズンタブが表示される
 * - 実績タブを開くとフィルターボタンが表示される
 */
import { test, expect } from "./fixtures";

test.describe("S20: 子供のコレクションページ", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/app/child/collection");
    await expect(page.getByRole("button", { name: /📖 図鑑/ })).toBeVisible({
      timeout: 15000,
    });
  });

  test("3つのタブ（図鑑・アイテム・実績）が表示される", async ({ page }) => {
    await expect(page.getByRole("button", { name: /📖 図鑑/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /🎁 アイテム/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /🏅 実績/ })).toBeVisible();
  });

  test("デフォルトでは図鑑タブが選択されモンスター図鑑が表示される", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /モンスター図鑑/ })).toBeVisible({
      timeout: 10000,
    });
    // 全 X / Y 体表示
    await expect(page.getByText(/\d+ \/ \d+ 体/)).toBeVisible();
  });

  test("「🎁 アイテム」タブをクリックするとアイテムコンテンツが表示される", async ({ page }) => {
    await page.getByRole("button", { name: /🎁 アイテム/ }).click();
    await expect(page.getByRole("heading", { name: /コレクションアイテム/ })).toBeVisible({
      timeout: 10000,
    });
    // シーズンタブ（春/夏/秋/冬）
    await expect(page.getByRole("button", { name: /春/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /夏/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /秋/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /冬/ })).toBeVisible();
  });

  test("「🏅 実績」タブをクリックすると実績フィルターが表示される", async ({ page }) => {
    await page.getByRole("button", { name: /🏅 実績/ }).click();
    await expect(page.getByRole("button", { name: "すべて" })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("button", { name: "解除済み" })).toBeVisible();
    await expect(page.getByRole("button", { name: "未解除" })).toBeVisible();
  });

  test("タブを切り替えられる（図鑑 → アイテム → 実績 → 図鑑）", async ({ page }) => {
    // アイテムへ
    await page.getByRole("button", { name: /🎁 アイテム/ }).click();
    await expect(page.getByRole("heading", { name: /コレクションアイテム/ })).toBeVisible();
    // 実績へ
    await page.getByRole("button", { name: /🏅 実績/ }).click();
    await expect(page.getByRole("button", { name: "すべて" })).toBeVisible();
    // 図鑑へ戻る
    await page.getByRole("button", { name: /📖 図鑑/ }).click();
    await expect(page.getByRole("heading", { name: /モンスター図鑑/ })).toBeVisible();
  });
});
