/**
 * S7: クエストスキップ申請フロー
 * 前提: as-child プロジェクト（storageState: child-light.json）で実行
 *
 * - アクションシートの「😴 今日はスキップする」をクリックするとスキップフォームが展開
 * - スキップ理由を入力して申請できる
 * - 境界値: 理由未入力では「スキップを申請する」ボタンが無効
 * - 「戻る」で通常状態に戻れる
 */
import { test, expect } from "@playwright/test";

test.describe("S7: クエストスキップ申請", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/child/quests");
    await expect(page.getByRole("heading", { name: /今日のクエスト/ })).toBeVisible({
      timeout: 15000,
    });
  });

  test("PENDING クエストのアクションシートにスキップボタンが表示される", async ({ page }) => {
    const pendingQuest = page.locator(".bg-quest-card.border.cursor-pointer").first();
    const count = await pendingQuest.count();

    if (count === 0) {
      test.skip(true, "今日はPENDINGクエストがないためスキップ");
      return;
    }

    await pendingQuest.click();
    await expect(page.getByText(/今日はスキップする/)).toBeVisible({ timeout: 5000 });
  });

  test("スキップボタンクリックでスキップ理由入力フォームが展開される", async ({ page }) => {
    const pendingQuest = page.locator(".bg-quest-card.border.cursor-pointer").first();
    const count = await pendingQuest.count();

    if (count === 0) {
      test.skip(true, "今日はPENDINGクエストがないためスキップ");
      return;
    }

    await pendingQuest.click();
    await page.getByText(/今日はスキップする/).click();

    // スキップ理由入力フォームが展開
    await expect(page.getByText("スキップする理由を入力してね")).toBeVisible();
    await expect(page.locator('input[placeholder="理由を入力（必須）"]')).toBeVisible();
    await expect(page.getByRole("button", { name: /スキップを申請する/ })).toBeVisible();
  });

  test("境界値: スキップ理由未入力では「スキップを申請する」が無効", async ({ page }) => {
    const pendingQuest = page.locator(".bg-quest-card.border.cursor-pointer").first();
    const count = await pendingQuest.count();

    if (count === 0) {
      test.skip(true, "今日はPENDINGクエストがないためスキップ");
      return;
    }

    await pendingQuest.click();
    await page.getByText(/今日はスキップする/).click();

    // 理由未入力の状態ではボタンが無効
    await expect(page.getByRole("button", { name: /スキップを申請する/ })).toBeDisabled();
  });

  test("スキップ理由を入力して申請できる", async ({ page }) => {
    const pendingQuest = page.locator(".bg-quest-card.border.cursor-pointer").first();
    const count = await pendingQuest.count();

    if (count === 0) {
      test.skip(true, "今日はPENDINGクエストがないためスキップ");
      return;
    }

    await pendingQuest.click();
    await page.getByText(/今日はスキップする/).click();

    await page.fill('input[placeholder="理由を入力（必須）"]', "体調が悪いため");
    await expect(page.getByRole("button", { name: /スキップを申請する/ })).toBeEnabled();

    await page.getByRole("button", { name: /スキップを申請する/ }).click();

    // 成功画面: スキップ申請完了
    await expect(page.getByText("スキップを申請したよ")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("親が確認するよ")).toBeVisible();
  });

  test("スキップフォームの「戻る」ボタンで元に戻る", async ({ page }) => {
    const pendingQuest = page.locator(".bg-quest-card.border.cursor-pointer").first();
    const count = await pendingQuest.count();

    if (count === 0) {
      test.skip(true, "今日はPENDINGクエストがないためスキップ");
      return;
    }

    await pendingQuest.click();
    await page.getByText(/今日はスキップする/).click();

    await expect(page.locator('input[placeholder="理由を入力（必須）"]')).toBeVisible();

    // 「戻る」ボタンを押す
    await page.getByRole("button", { name: /^戻る$/ }).click();

    // スキップフォームが閉じて、元のアクションシートに戻る
    await expect(page.locator('input[placeholder="理由を入力（必須）"]')).not.toBeVisible();
    await expect(page.getByRole("button", { name: /クエスト完了/ })).toBeVisible();
  });
});
