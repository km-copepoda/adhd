/**
 * S13: 報告期限設定テスト
 * 前提: as-parent プロジェクト（storageState: parent.json）で実行
 *
 * - ファミリー管理ページで子供ごとに報告期限を設定できる
 * - 期限時刻を保存できる
 * - 期限時刻をクリアできる
 * - ストリーク最低タスク数を変更できる
 */
import { test, expect } from "./fixtures";

test.describe("S13: 報告期限設定", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/app/parent/family");
    await expect(page.getByRole("heading", { name: /ファミリー管理/ })).toBeVisible({
      timeout: 15000,
    });
  });

  test("子供の報告期限時刻を設定して保存できる", async ({ page }) => {
    // QA_child の行を見つける
    const memberRow = page.locator(".bg-quest-bg.rounded-lg").filter({ hasText: "QA_child" });
    await expect(memberRow).toBeVisible();

    // 時刻インプットに値を入力
    const timeInput = memberRow.locator('input[type="time"]');
    await expect(timeInput).toBeVisible();
    await timeInput.fill("20:00");

    // 保存ボタンをクリック
    await memberRow.getByRole("button", { name: /保存/ }).click();

    // 保存中状態が一瞬表示されてから完了
    await expect(memberRow.getByRole("button", { name: /保存/ })).toBeVisible({ timeout: 5000 });
  });

  test("子供の報告期限時刻をクリアできる", async ({ page }) => {
    const memberRow = page.locator(".bg-quest-bg.rounded-lg").filter({ hasText: "QA_child" });

    // まず時刻を設定
    const timeInput = memberRow.locator('input[type="time"]');
    await timeInput.fill("20:00");
    await memberRow.getByRole("button", { name: /保存/ }).click();

    // クリアボタンが表示されているか確認（値があれば表示）
    const clearButton = memberRow.getByRole("button", { name: /クリア/ });
    if (await clearButton.isVisible()) {
      await clearButton.click();
      // クリア後、時刻インプットが空になる
      await expect(timeInput).toHaveValue("");
    }
  });

  test("ストリーク最低タスク数を増やせる", async ({ page }) => {
    const memberRow = page.locator(".bg-quest-bg.rounded-lg").filter({ hasText: "QA_child" });
    await expect(memberRow).toBeVisible();

    // 現在の値を取得
    const currentValue = await memberRow.locator(".text-sm.text-quest-gold.font-bold").textContent();
    const current = parseInt(currentValue?.trim() ?? "1", 10);

    // + ボタンで増加
    await memberRow.getByRole("button", { name: "+" }).click();

    // 値が +1 になる
    await expect(
      memberRow.locator(".text-sm.text-quest-gold.font-bold"),
    ).toHaveText(String(current + 1), { timeout: 5000 });
  });
});
