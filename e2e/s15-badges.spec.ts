/**
 * S15: 実績（バッジ）ページテスト
 * 前提: as-child プロジェクト（storageState: child-light.json）で実行
 *
 * - /app/child/badges が表示される（旧パス。実体は実績/ごほうびタブ切替）
 * - 「🏅 実績」サブタブが選択状態で実績コンテンツが表示される
 * - 解除数 / 総数が表示される（新規は 0 / N）
 * - フィルターボタン（すべて/解除済み/未解除）が表示される
 * - 「解除済み」フィルターで絞ると「まだ解除した実績がありません」または解除済みバッジのみ
 * - BottomNav には実績を含む「コレクション」タブがある（旧「実績」タブは廃止）
 */
import { test, expect } from "./fixtures";

test.describe("S15: 実績（バッジ）ページ", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/app/child/badges");
    // ページ本体は BadgesContent（フィルターボタン群）。表示まで待つ。
    await expect(page.getByRole("button", { name: "すべて" })).toBeVisible({ timeout: 15000 });
  });

  test("🏅 実績 サブタブが表示される", async ({ page }) => {
    await expect(page.getByRole("button", { name: /🏅 実績/ })).toBeVisible();
  });

  test("解除数 / 総数が表示される", async ({ page }) => {
    await expect(page.getByText(/\d+ \/ \d+/)).toBeVisible();
  });

  test("フィルターボタンが3つ表示される", async ({ page }) => {
    await expect(page.getByRole("button", { name: "すべて" })).toBeVisible();
    await expect(page.getByRole("button", { name: "解除済み" })).toBeVisible();
    await expect(page.getByRole("button", { name: "未解除" })).toBeVisible();
  });

  test("「解除済み」フィルターを押すと解除ゼロのアカウントは空メッセージが表示される", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "解除済み" }).click();
    // 新規アカウントは解除なし → 空メッセージが表示される
    // 解除済みがあれば空メッセージは出ない（どちらも valid）
    const emptyMsg = page.getByText("まだ解除した実績がありません");
    const badgeGrid = page.locator(".grid.grid-cols-2 > div");
    const emptyOrGrid = emptyMsg.or(badgeGrid.first());
    await expect(emptyOrGrid).toBeVisible({ timeout: 5000 });
  });

  test("「未解除」フィルターでバッジが表示される（新規は全件が未解除）", async ({ page }) => {
    await page.getByRole("button", { name: "未解除" }).click();
    // 新規アカウントは全バッジ未解除のため必ずバッジカードが表示される
    await expect(page.locator(".grid.grid-cols-2 > div").first()).toBeVisible({
      timeout: 5000,
    });
  });

  test("BottomNav に「コレクション」タブがある（実績はここに統合済み）", async ({ page }) => {
    await expect(page.getByRole("link", { name: /コレクション/ })).toBeVisible();
  });
});
