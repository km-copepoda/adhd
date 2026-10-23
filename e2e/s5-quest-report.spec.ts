/**
 * S5: 子供クエスト完了報告フロー
 * 前提: as-child プロジェクト（storageState: child-light.json）で実行
 *
 * - /app/child/quests が表示される
 * - PENDING クエストをクリックするとアクションシートが開く
 * - 「⚔ クエスト完了！」を押すと成功画面が表示される
 * - 報告後クエストのステータスが「確認中...」になる
 *
 * 前提データ（今日の PENDING クエスト）は helpers/testData.ts で毎回用意する（Issue #221）。
 */
import { test, expect } from "./fixtures";
import {
  openSessions,
  seedQuestInStatus,
  type SeededQuest,
  type Sessions,
} from "./helpers/testData";

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
  });

  test("タスク追加ボタンが表示される", async ({ page }) => {
    await expect(page.getByRole("button", { name: /タスクを追加/ })).toBeVisible();
  });

  test.describe("今日の PENDING クエストがある場合", () => {
    let sessions: Sessions;
    let quest: SeededQuest;

    test.beforeEach(async ({ page }) => {
      sessions = await openSessions();
      quest = await seedQuestInStatus(sessions, "PENDING", { tag: "s5" });
      // データ作成後に再取得する（Realtime 待ちで flaky にしない）
      await page.reload();
      await expect(page.getByRole("heading", { name: /今日のクエスト/ })).toBeVisible({
        timeout: 15000,
      });
    });

    test.afterEach(async () => {
      await sessions?.dispose();
    });

    test("クエストがあると「N / M 完了」の進捗が表示される", async ({ page }) => {
      // 旧実装は他 spec が作ったクエストの存在に暗黙に依存していた（Issue #221）
      await expect(page.getByText(/\/ \d+ 完了/)).toBeVisible();
    });

    test("PENDING クエストをタップするとアクションシートが開く", async ({ page }) => {
      const card = page.locator(".bg-quest-card.border.cursor-pointer").filter({ hasText: quest.title });
      await expect(card).toBeVisible();
      await card.click();

      await expect(page.getByRole("button", { name: /クエスト完了/ })).toBeVisible({ timeout: 5000 });
      await expect(page.getByText(/今日はスキップする/)).toBeVisible();
    });

    test("アクションシートの「⚔ クエスト完了！」でクエスト報告できる", async ({ page }) => {
      const card = page.locator(".bg-quest-card.border.cursor-pointer").filter({ hasText: quest.title });
      await expect(card).toBeVisible();
      await card.click();
      await expect(page.getByRole("button", { name: /クエスト完了/ })).toBeVisible({ timeout: 5000 });

      await page.getByRole("button", { name: /クエスト完了/ }).click();

      // 成功画面が表示される
      await expect(page.getByText("クエスト完了！")).toBeVisible({ timeout: 10000 });
      await expect(page.getByText("親の確認でポイント確定")).toBeVisible();
    });

    test("アクションシートは背景クリックで閉じる", async ({ page }) => {
      const card = page.locator(".bg-quest-card.border.cursor-pointer").filter({ hasText: quest.title });
      await expect(card).toBeVisible();
      await card.click();
      await expect(page.getByRole("button", { name: /クエスト完了/ })).toBeVisible({ timeout: 5000 });

      // 背景（バックドロップ）をクリックして閉じる
      await page.locator(".fixed.inset-0").first().click({ position: { x: 10, y: 10 } });
      await expect(page.getByRole("button", { name: /クエスト完了/ })).not.toBeVisible();
    });
  });
});
