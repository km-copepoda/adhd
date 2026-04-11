/**
 * S16: 親 - 過去の記録（履歴ヒートマップ）
 * 
 * 前提: as-parent (parent.json で認証された状態) で実行
 * 対象: /app/parent/history
 * 
 * テスト内容:
 * - ヒートマップカレンダーの表示
 * - 月ナビゲーション（前月・次月）
 * - 日付クリックで詳細表示
 * - 月次サマリーカード表示
 * - 子供切り替え（複数子供がいる場合）
 */
import { test, expect } from "./fixtures";

test.describe("S16: 履歴ページ", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("/app/parent/history");
        await expect(
            page.getByRole("heading", { name: /過去の記録/ }),
        ).toBeVisible({ timeout: 15000 });
    })

    test("見出し 「過去の記録」が表示されること", async ({ page }) => {
        await expect(page.getByRole("heading", { name: /過去の記録/ })).toBeVisible();
    });

    test("月次サマリーカード（達成日数・完了数・XP）が表示されること", async ({ page }) => {
        // 3つのサマリーカードがあることを確認
        await expect(page.getByText(/達成日数/)).toBeVisible();
        await expect(page.getByText(/完了タスク数/)).toBeVisible();
        await expect(page.getByText(/獲得XP/)).toBeVisible();
    });

    test("ヒートマップカレンダーに曜日ヘッダーが表示されること", async ({ page }) => {
        const dayHeaders = page.locator(".grid.grid-cols-7");
        await expect(dayHeaders.first()).toBeVisible();
        // 曜日ラベルが含まれていることを確認
        await expect(page.getByText("日").first()).toBeVisible();
        await expect(page.getByText("月").first()).toBeVisible();
        await expect(page.getByText("火").first()).toBeVisible();
        await expect(page.getByText("水").first()).toBeVisible();
        await expect(page.getByText("木").first()).toBeVisible();
        await expect(page.getByText("金").first()).toBeVisible();
        await expect(page.getByText("土").first()).toBeVisible();
    });

    test("月ナビゲーションで前月・次月に移動できること", async ({ page }) => {
        // 現在の月表示を取得
        const monthDisplay = page.locator("text=/\\d{4}年\\d{1,2}月/").first();
        await expect(monthDisplay).toBeVisible();
        const currentMonth = await monthDisplay.textContent();

        // 前月移動
        const prevButton = page.getByRole("button", { name: /◀/ });
        await expect(prevButton).toBeVisible();
        await prevButton.click();

        // 月表示が更新されていることを確認
        await expect(monthDisplay).not.toHaveText(currentMonth!);

        // 元の月に戻るかどうか移動
        const nextButton = page.getByRole("button", { name: /▶/ });
        await expect(nextButton).toBeVisible();
        await nextButton.click();
        await expect(monthDisplay).toHaveText(currentMonth!);
    });

    test("カレンダーの日付)をクリックすると、その日の詳細が表示されること", async ({ page }) => {
        // 有効な日付ボタンをクリック　(最初の disabled でない日付をクリック)
        const dayCells = page.locator(".grid.grid-cols-7 button:not(:disabled)");
        const count = await dayCells.count();
        if (count === 0) {
            test.skip(true, "クリック可能な日付がないためスキップ");
            return
        }

        await dayCells.first().click();

        // 日付詳細のモーダルが表示されることを確認
        await expect(page.getByText(/件完了/).or(page.getByText(/件未完了/))).toBeVisible({ timeout: 5000 });
    });
});