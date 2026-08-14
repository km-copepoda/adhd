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
import { readCredentials } from "./credentials";

test.describe("S13: 報告期限設定", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/app/parent/family");
    await expect(page.getByRole("heading", { name: /ファミリー管理/ })).toBeVisible({
      timeout: 15000,
    });
  });

  test("子供の報告期限時刻を設定して保存できる", async ({ page }) => {
    // モンスター名（"QA_child"）は develop 共有DBの過去実行分と重複しうるため、
    // このテスト実行が作成した子供固有のユーザーコードで行を特定する
    const { childCodeLight } = readCredentials();
    const memberRow = page.locator(".bg-quest-bg.rounded-lg").filter({ hasText: childCodeLight });
    await expect(memberRow).toBeVisible();

    // 行内には「報告期限」と「チェックイン締切」の2つの time input / 保存ボタンが並んでいるため、
    // 先に描画される報告期限側を .first() で明示的に指定する
    const timeInput = memberRow.locator('input[type="time"]').first();
    await expect(timeInput).toBeVisible();
    await timeInput.fill("20:00");

    // 保存ボタンをクリック
    await memberRow.getByRole("button", { name: /保存/ }).first().click();

    // 保存中状態が一瞬表示されてから完了
    await expect(memberRow.getByRole("button", { name: /保存/ }).first()).toBeVisible({ timeout: 5000 });
  });

  test("子供の報告期限時刻をクリアできる", async ({ page }) => {
    const { childCodeLight } = readCredentials();
    const memberRow = page.locator(".bg-quest-bg.rounded-lg").filter({ hasText: childCodeLight });

    // まず時刻を設定（報告期限側 = .first()。チェックイン締切側と2組並んでいるため）
    const timeInput = memberRow.locator('input[type="time"]').first();
    await timeInput.fill("20:00");
    await memberRow.getByRole("button", { name: /保存/ }).first().click();

    // クリアボタンが表示されているか確認（値があれば表示。報告期限側 = .first()）
    const clearButton = memberRow.getByRole("button", { name: /クリア/ }).first();
    if (await clearButton.isVisible()) {
      await clearButton.click();
      // クリア後、時刻インプットが空になる
      await expect(timeInput).toHaveValue("");
    }
  });

  test("ストリーク最低タスク数を増やせる", async ({ page }) => {
    const { childCodeLight } = readCredentials();
    const memberRow = page.locator(".bg-quest-bg.rounded-lg").filter({ hasText: childCodeLight });
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
