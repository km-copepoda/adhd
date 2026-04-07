/**
 * S11: 育成画面テスト
 * 前提: as-child プロジェクト（storageState: child-light.json）で実行
 *
 * - /app/child/monster が表示される
 * - 新規アカウントはたまご（stage 0）からスタート
 * - XP 進捗バーが表示される
 * - ストリークカードが表示される
 * - 合計ポイントカードが表示される
 * - パラメータカード（学力/体力/生活力）が表示される
 */
import { test, expect } from "./fixtures";

test.describe("S11: 育成画面", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/app/child/monster");
    // モンスター画像コンテナが表示されるまで待つ
    await expect(page.locator(".w-56.h-56")).toBeVisible({ timeout: 15000 });
  });

  test("育成画面が正しく表示される（モンスター画像あり）", async ({ page }) => {
    await expect(page.locator(".w-56.h-56")).toBeVisible();
  });

  test("XP 進捗バー（あと N pt で孵化/進化）が表示される", async ({ page }) => {
    // 新規アカウントは「あと N pt で孵化！」テキストが表示される
    await expect(page.getByText(/pt で/)).toBeVisible();
  });

  test("ストリークカードが表示される", async ({ page }) => {
    await expect(page.getByText(/日連続/)).toBeVisible();
  });

  test("合計ポイントカードが表示される", async ({ page }) => {
    await expect(page.getByText("合計ポイント")).toBeVisible();
  });

  test("パラメータカード（学力/体力/生活力）が3つ表示される", async ({ page }) => {
    await expect(page.getByText("学力", { exact: true })).toBeVisible();
    await expect(page.getByText("体力", { exact: true })).toBeVisible();
    await expect(page.getByText("生活力", { exact: true })).toBeVisible();
  });

  test("たまごまたは進化途中のステージである（孵化/進化テキストが表示される）", async ({ page }) => {
    // s10（as-parent）でXPが付与されて孵化済みの場合は「進化」、まだなら「孵化」
    await expect(page.getByText(/孵化|進化/)).toBeVisible();
  });
});
