/**
 * S10: 全フロー統合テスト
 * 前提: as-parent プロジェクト（storageState: parent.json）で実行
 *
 * 「親がタスク作成 → 子供がクエスト完了報告 → 親が承認 → リストから消える」
 * の一連の流れを1テストで検証する。
 *
 * - 一時タスク（今日対象）を API で作成
 * - 子供コンテキストで /app/child/quests に表示されることを確認
 * - 子供がクエスト完了報告する
 * - 親の承認センターに表示される
 * - 親が承認するとリストから消える
 */
import { test, expect } from "./fixtures";
import path from "path";
import { createBrowserContext } from "./credentials";

const CHILD_AUTH = path.join(process.cwd(), "playwright/.auth/child-light.json");

test.describe("S10: 全フロー統合", () => {
  test("一時タスク作成 → クエスト報告 → 承認の全フローが完結する", async ({ page, browser }) => {
    const taskTitle = `S10_fullflow_${Date.now()}`;

    // --- 1. 親: 子供の ID を取得してから一時タスクを API で作成 ---
    const familyRes = await page.request.get("/api/family/code");
    const familyData = await familyRes.json();
    const child = familyData.members.find(
      (m: { role: string; monsterName: string | null }) => m.role === "CHILD",
    );
    expect(child).toBeTruthy();

    const taskRes = await page.request.post("/api/tasks", {
      data: {
        title: taskTitle,
        emoji: "📚",
        category: "STUDY",
        isTemporary: true,
        // targetDate 未指定 = 今日が自動設定される
        assignedChildId: child.id,
      },
    });
    expect(taskRes.ok()).toBeTruthy();

    // --- 2. 子供コンテキスト: クエスト一覧に表示されることを確認して報告 ---
    const { context: childCtx, page: childPage } = await createBrowserContext(browser, CHILD_AUTH);
    try {
      await childPage.goto("/app/child/quests");
      await expect(childPage.getByRole("heading", { name: /今日のクエスト/ })).toBeVisible({
        timeout: 15000,
      });

      // 作成したタスクがクエスト一覧に表示される
      const questCard = childPage
        .locator(".bg-quest-card.border.cursor-pointer")
        .filter({ hasText: taskTitle });
      await expect(questCard).toBeVisible({ timeout: 10000 });

      // クエストカードをタップしてアクションシートを開く
      await questCard.click();
      await expect(childPage.getByRole("button", { name: /クエスト完了！/ })).toBeVisible({
        timeout: 5000,
      });

      // 完了報告
      await childPage.getByRole("button", { name: /クエスト完了！/ }).click();

      // 報告後、カードのステータスが変わる（確認中...）
      await expect(childPage.getByText(/確認中/).first()).toBeVisible({ timeout: 10000 });
    } finally {
      await childCtx.close();
    }

    // --- 3. 親: 承認センターで対象クエストを承認 ---
    await page.goto("/app/parent/approve");
    await expect(page.getByRole("heading", { name: /承認センター/ })).toBeVisible({
      timeout: 15000,
    });

    const approveCard = page
      .locator(".bg-quest-card.border.rounded-xl.cursor-pointer")
      .filter({ hasText: taskTitle });
    await expect(approveCard).toBeVisible({ timeout: 10000 });
    await approveCard.click();

    // 承認後、該当カードがリストから消える
    await expect(approveCard).not.toBeVisible({ timeout: 10000 });
  });
});
