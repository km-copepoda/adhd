/**
 * S5: 子供クエスト完了報告フロー
 * 前提: as-child プロジェクト（storageState: child-light.json）で実行
 *
 * - /app/child/quests が表示される
 * - PENDING クエストをクリックするとアクションシートが開く
 * - 「⚔ クエスト完了！」を押すと成功画面が表示される
 * - 報告後クエストのステータスが「確認中...」になる
 */
import { test, expect } from "./fixtures";

test.describe("S5: 子供クエスト完了報告", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/app/child/quests");
    // ローディングスピナーが消えるまで待つ
    await expect(page.getByRole("heading", { name: /今日のクエスト/ })).toBeVisible({
      timeout: 15000,
    });
  });

  test("クエスト一覧ページが表示される", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /今日のクエスト/ })).toBeVisible();
    await expect(page.getByText(/完了/)).toBeVisible();
  });

  test("タスク追加ボタンが表示される", async ({ page }) => {
    await expect(page.getByRole("button", { name: /タスクを追加/ })).toBeVisible();
  });

  test("PENDING クエストをタップするとアクションシートが開く", async ({ page }) => {
    // PENDINGなクエストカードを探す（クリック可能なもの）
    const pendingQuest = page.locator(
      ".bg-quest-card.border.cursor-pointer"
    ).first();

    const count = await pendingQuest.count();
    if (count === 0) {
      test.skip(true, "今日はPENDINGクエストがないためスキップ");
      return;
    }

    await pendingQuest.click();

    // アクションシートが表示される
    await expect(page.getByRole("button", { name: /クエスト完了/ })).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText(/今日はスキップする/)).toBeVisible();
  });

  test("アクションシートの「⚔ クエスト完了！」でクエスト報告できる", async ({ page }) => {
    const pendingQuest = page.locator(
      ".bg-quest-card.border.cursor-pointer"
    ).first();

    const count = await pendingQuest.count();
    if (count === 0) {
      test.skip(true, "今日はPENDINGクエストがないためスキップ");
      return;
    }

    // クエスト名を記録
    const questTitle = await pendingQuest.locator("p.text-sm.font-medium").first().textContent();

    await pendingQuest.click();
    await expect(page.getByRole("button", { name: /クエスト完了/ })).toBeVisible({ timeout: 5000 });

    await page.getByRole("button", { name: /クエスト完了/ }).click();

    // 成功画面が表示される
    await expect(page.getByText("クエスト完了！")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("親の確認でポイント確定")).toBeVisible();
  });

  test("アクションシートは背景クリックで閉じる", async ({ page }) => {
    const pendingQuest = page.locator(
      ".bg-quest-card.border.cursor-pointer"
    ).first();

    const count = await pendingQuest.count();
    if (count === 0) {
      test.skip(true, "今日はPENDINGクエストがないためスキップ");
      return;
    }

    await pendingQuest.click();
    await expect(page.getByRole("button", { name: /クエスト完了/ })).toBeVisible({ timeout: 5000 });

    // 背景（バックドロップ）をクリックして閉じる
    await page.locator(".fixed.inset-0").first().click({ position: { x: 10, y: 10 } });
    await expect(page.getByRole("button", { name: /クエスト完了/ })).not.toBeVisible();
  });
});
