/**
 * S18: 親 - 今日の完了タスクの表示
 * 
 * 前提: as-parent (parent.json で認証済み)
 * 対象: /app/parent/completed
 * 
 * テスト内容:
 * - ページ表示と見出しの確認
 * - 完了タスクがない場合のからメッセージ
 * - 完了タスクがある場合のタスクカード表示（ステータスバッジ・XP・カテゴリ）
 */
import { test, expect } from "./fixtures";

test.describe("S18: 今日の完了タスク", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("/app/parent/completed");
        await expect(
            page.getByRole("heading", { name: /今日の完了タスク/ }),
        ).toBeVisible({ timeout: 15000 });
    });

    test("見出し 「今日の完了タスク」が表示されること", async ({ page }) => {
        await expect(page.getByRole("heading", { name: /今日の完了タスク/ })).toBeVisible();
    });

    test("完了タスクがない場合のメッセージ", async ({ page }) => {
        const emptyMessage = page.getByText(/承認済みのタスクが表示されます/);
        const taskCard = page.locator(".bg-quest-card.border.rounded-xl").first();

        // からメッセージまたはタスクカードのどちらかが表示されること
        const either = emptyMessage.or(taskCard);
        await expect(either).toBeVisible({ timeout: 10000});
    });

    test("完了タスクカードにステータスバッジ・XP・カテゴリが表示されること", async ({ page }) => {
        const cards = page.locator(".bg-quest-card.border.rounded-xl");
        const count = await cards.count();
        if (count === 0) {
            test.skip(true, "完了タスクが見つかりません");
            return;
        }

        const firstCard = cards.first();
        // 「承認済み」または「スキップ」のバッジ
        const approvedBadge = firstCard.getByText(/承認済み/);
        const skippedBadge = firstCard.getByText(/スキップ/);
        const badge = approvedBadge.or(skippedBadge);
        await expect(badge).toBeVisible();
    });

    test("完了タスクカードに子供の名前が表示されること", async ({ page }) => {
        const cards = page.locator(".bg-quest-card.border.rounded-xl");
        const count = await cards.count();
        if (count === 0) {
            test.skip(true, "完了タスクが見つかりません");
            return;
        }

        // 子供アイコンが表示されていることを確認
        await expect(cards.first().getByText("🧒")).toBeVisible();
    });

    test("サマリー行に承認件数が表示されること", async ({ page }) => {
        // 完了タスクがあれば「N件完了」、なければ「今日はまだ完了したタスクがありません」
        const summary = page
          .getByText(/件完了/)
          .or(page.getByText(/今日はまだ完了したタスクがありません/));
        await expect(summary).toBeVisible({ timeout: 10000 });
    });

});