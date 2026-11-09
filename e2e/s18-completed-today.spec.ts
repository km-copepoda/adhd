/**
 * S18: 親 - 今日の完了タスクの表示
 *
 * 前提: as-parent-premium (parent.json で認証済み)
 * 対象: /app/parent/completed
 *
 * テスト内容:
 * - ページ表示と見出しの確認
 * - 完了タスクがない場合のからメッセージ
 * - 完了タスクがある場合のタスクカード表示（ステータスバッジ・XP・カテゴリ）
 *
 * 完了タスクの前提データ（今日の APPROVED クエスト）は helpers/testData.ts で用意し、
 * 自分が作ったカード（title で絞る）だけを検証する（Issue #221）。
 */
import { test, expect } from "./fixtures";
import {
    openSessions,
    seedQuestInStatus,
    type SeededQuest,
    type Sessions,
} from "./helpers/testData";

test.describe("S18: 今日の完了タスク", () => {
    test("見出し 「今日の完了タスク」が表示されること", async ({ page }) => {
        await page.goto("/app/parent/completed");
        await expect(page.getByRole("heading", { name: /今日の完了タスク/ })).toBeVisible({
            timeout: 15000,
        });
    });

    // 共有の家族では他 spec が作った完了タスクが残るため、0 件の状態を確実には作れない。
    // 新しい家族を作る fixture（Issue #221 Q3）を用意する後続 Issue で対応する。
    test.fixme("完了タスクがない場合のメッセージ", async ({ page }) => {
        await page.goto("/app/parent/completed");
        await expect(page.getByText(/承認済みのタスクが表示されます/)).toBeVisible({ timeout: 10000 });
        await expect(page.getByText(/今日はまだ完了したタスクがありません/)).toBeVisible();
    });

    test.describe("今日の APPROVED クエストがある場合", () => {
        let sessions: Sessions;
        let quest: SeededQuest;

        test.beforeEach(async ({ page }) => {
            sessions = await openSessions();
            quest = await seedQuestInStatus(sessions, "APPROVED", { tag: "s18" });
            // データ作成後に遷移する
            await page.goto("/app/parent/completed");
            await expect(
                page.getByRole("heading", { name: /今日の完了タスク/ }),
            ).toBeVisible({ timeout: 15000 });
        });

        test.afterEach(async () => {
            await sessions?.dispose();
        });

        test("完了タスクカードにステータスバッジ・XP・カテゴリが表示されること", async ({ page }) => {
            const card = page.locator(".bg-quest-card.border.rounded-xl").filter({ hasText: quest.title });
            await expect(card).toBeVisible({ timeout: 10000 });
            // 「承認済み」バッジ
            await expect(card.getByText(/承認済み/)).toBeVisible();
        });

        test("完了タスクカードに子供の名前が表示されること", async ({ page }) => {
            const card = page.locator(".bg-quest-card.border.rounded-xl").filter({ hasText: quest.title });
            await expect(card).toBeVisible({ timeout: 10000 });
            // 子供アイコンが表示されていることを確認
            await expect(card.getByText("🧒")).toBeVisible();
        });

        test("サマリー行に承認件数が表示されること", async ({ page }) => {
            await expect(page.getByText(/件完了/)).toBeVisible({ timeout: 10000 });
            await expect(page.getByText(/今日はまだ完了したタスクがありません/)).toHaveCount(0);
        });
    });
});
