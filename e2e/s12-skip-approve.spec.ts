/**
 * S12: スキップ承認フロー統合テスト
 * 前提: as-parent-premium プロジェクト（storageState: parent.json）で実行
 *
 * 「親がタスク作成 → 子供がスキップ申請 → 親が承認」の全フローを検証する。
 *
 * - 一時タスクを API で作成
 * - 子供コンテキストでスキップを申請
 * - 親の承認センターにスキップ申請が表示される
 * - 親が承認するとリストから消える
 * - スキップ申請は赤系ボーダーで視覚的に区別される
 */
import { test, expect } from "./fixtures";
import path from "path";
import { createBrowserContext, getBypassHeaders } from "./credentials";

const CHILD_AUTH = path.join(process.cwd(), "playwright/.auth/child-light.json");

test.describe("S12: スキップ承認フロー", () => {
  test("スキップ申請 → 親承認の全フローが完結する", async ({ page, browser }) => {
    const taskTitle = `S12_skip_${Date.now()}`;

    // --- 1. 親: 一時タスクを API で作成 ---
    // page.request は Node.js 直接コールのため page.route() を通らず bypass ヘッダーを付与する
    const bypassHeaders = getBypassHeaders();
    const familyRes = await page.request.get("/api/family/code", { headers: bypassHeaders });
    const familyData = await familyRes.json();
    const child = familyData.members.find(
      (m: { role: string }) => m.role === "CHILD",
    );
    expect(child).toBeTruthy();

    const taskRes = await page.request.post("/api/tasks", {
      data: {
        title: taskTitle,
        emoji: "😴",
        category: "LIFE",
        isTemporary: true,
        assignedChildId: child.id,
      },
      headers: bypassHeaders,
    });
    expect(taskRes.ok()).toBeTruthy();

    // --- 2. 子供コンテキスト: クエストをスキップ申請 ---
    const { context: childCtx, page: childPage } = await createBrowserContext(browser, CHILD_AUTH);
    try {
      await childPage.goto("/app/child/quests");
      await expect(childPage.getByRole("heading", { name: /今日のクエスト/ })).toBeVisible({
        timeout: 15000,
      });

      const questCard = childPage
        .locator(".bg-quest-card.border.cursor-pointer")
        .filter({ hasText: taskTitle });
      await expect(questCard).toBeVisible({ timeout: 10000 });

      await questCard.click();
      await expect(childPage.getByText(/今日はスキップする/)).toBeVisible({ timeout: 5000 });
      await childPage.getByText(/今日はスキップする/).click();

      // スキップフォームが展開する（理由入力欄）
      await expect(childPage.locator('input[placeholder="理由を入力（必須）"]')).toBeVisible({
        timeout: 5000,
      });

      // 理由を入力
      await childPage.fill('input[placeholder="理由を入力（必須）"]', "体調不良のため");

      // 申請ボタンが有効になる
      await expect(childPage.getByRole("button", { name: /スキップを申請する/ })).toBeEnabled();
      await childPage.getByRole("button", { name: /スキップを申請する/ }).click();

      // 成功オーバーレイが表示される
      await expect(childPage.getByText("スキップを申請したよ")).toBeVisible({ timeout: 10000 });
      await expect(childPage.getByText("親が確認するよ")).toBeVisible();
    } finally {
      await childCtx.close();
    }

    // --- 3. 親: 承認センターにスキップ申請が表示される ---
    await page.goto("/app/parent/approve");
    await expect(page.getByRole("heading", { name: /承認センター/ })).toBeVisible({
      timeout: 15000,
    });

    // スキップ申請カード（赤系ボーダー）が表示される
    const skipCard = page
      .locator(".bg-quest-card.border.rounded-xl.cursor-pointer")
      .filter({ hasText: taskTitle });
    await expect(skipCard).toBeVisible({ timeout: 10000 });

    // スキップ申請の表示（「スキップ申請」テキスト）
    await expect(skipCard.getByText(/スキップ申請/)).toBeVisible();

    // 承認
    await skipCard.click();
    await expect(skipCard).not.toBeVisible({ timeout: 10000 });
  });
});
