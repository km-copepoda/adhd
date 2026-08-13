/**
 * S17: 親 - タスクの編集・削除
 * 
 * 前提: as-parent (parent.json で認証済み)
 * 対象: /app/parent/tasks
 * 
 * テスト内容:
 * - タスクの編集フロー（編集ボタン -> 編集フォーム - > 変更保存）
 * - タスクの削除フロー（削除ボタン -> 確認ダイアログ -> 削除確定）
 * - 一時タスクの削除
 */
import { test, expect } from "./fixtures";
import { getBypassHeaders } from "./credentials";

test.describe("S17: タスクの編集・削除", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("/app/parent/tasks");
        await expect(
            page.getByRole("heading", { name: /タスク管理/ }),
        ).toBeVisible({ timeout: 15000 });
    });

    test("通常タスクに「編集」ボタンと「削除」ボタンが表示されること", async ({ page }) => {
        const bypassHeaders = getBypassHeaders();

        // テスト用の通常タスクを作成
        const familyRes = await page.request.get("/api/family/code", { headers: bypassHeaders });
        const familyData = await familyRes.json();
        const children = familyData.members?.filter((m: { id: string; role: string }) => m.role === "CHILD") ?? [];
        if (children.length === 0) {
            test.skip(true, "テスト用の子供アカウントが見つかりません");
            return;
        }

        const taskTitle = `E2E編集テスト_${Date.now()}`;
        const taskRes = await page.request.post("/api/tasks", {
            data: {
                title: taskTitle,
                emoji: "📚",
                category: "STUDY",
                repeatDays: [0, 1, 2, 3, 4, 5, 6],
                assignedChildId: children[0].id,
            },
            headers: bypassHeaders,
        });
        expect(taskRes.ok()).toBeTruthy();

        // ページをロードして新タスクを表示
        await page.reload();
        await expect(page.getByRole("heading", { name: /タスク管理/ })).toBeVisible({ timeout: 15000 });

        // 作成したタスクの行を見つける
        const taskCard = page.locator(".bg-quest-card.border.rounded-xl").filter({ hasText: taskTitle });
        await expect(taskCard).toBeVisible({ timeout: 10000 });

        // 「編集」ボタンと「削除」ボタンが表示されることを確認
        const editButton = taskCard.getByRole("button", { name: /編集/ });
        const deleteButton = taskCard.getByRole("button", { name: /削除/ });
        await expect(editButton).toBeVisible();
        await expect(deleteButton).toBeVisible();
    });

    test("「編集」ボタンをクリックすると編集フォームが表示されること", async ({ page }) => {
        const bypassHeaders = getBypassHeaders();

        // テスト用の通常タスクを作成
        const familyRes = await page.request.get("/api/family/code", { headers: bypassHeaders });
        const familyData = await familyRes.json();
        const children = familyData.members?.filter((m: { id: string; role: string }) => m.role === "CHILD") ?? [];
        if (children.length === 0) {
            test.skip(true, "テスト用の子供アカウントが見つかりません");
            return;
        }

        const taskTitle = `E2E編集フォームテスト_${Date.now()}`;
        const taskRes = await page.request.post("/api/tasks", {
            data: {
                title: taskTitle,
                emoji: "📚",
                category: "STUDY",
                repeatDays: [0, 1, 2, 3, 4, 5, 6],
                assignedChildId: children[0].id,
            },
            headers: bypassHeaders,
        });
        expect(taskRes.ok()).toBeTruthy();

        await page.reload();
        await expect(page.getByRole("heading", { name: /タスク管理/ })).toBeVisible({ timeout: 15000 });

        // 作成したタスクの行を見つける
        const taskCard = page.locator(".bg-quest-card.border.rounded-xl").filter({ hasText: taskTitle });
        await expect(taskCard).toBeVisible({ timeout: 10000 });

        await taskCard.getByRole("button", { name: /編集/ }).click();

        // 編集フォームが表示されることを確認
        const form = page.getByRole("button", { name: /更新/ });
        await expect(form).toBeVisible({ timeout: 5000 });
    });

    test("「削除」ボタンクリック -> 確認ダイアログでタスクが削除されること", async ({ page }) => {
        const bypassHeaders = getBypassHeaders();

        // 削除用の一時タスクを作成
        const familyRes = await page.request.get("/api/family/code", { headers: bypassHeaders });
        const familyData = await familyRes.json();
        const children = familyData.members?.filter((m: { id: string; role: string }) => m.role === "CHILD") ?? [];
        if (children.length === 0) {
            test.skip(true, "テスト用の子供アカウントが見つかりません");
            return;
        }
        const taskTitle = `E2E削除テスト_${Date.now()}`;
        const taskRes = await page.request.post("/api/tasks", {
            data: {
                title: taskTitle,
                emoji: "🗑️",
                category: "LIFE",
                isTemporary: true,
                assignedChildId: children[0].id,
            },
            headers: bypassHeaders,
        });
        expect(taskRes.ok()).toBeTruthy();

        // リロードしてタスクを表示
        await page.reload();
        await expect(page.getByRole("heading", { name: /タスク管理/ })).toBeVisible({ timeout: 15000 });

        const taskCard = page.locator(".bg-quest-card.border.rounded-xl").filter({ hasText: taskTitle });
        await expect(taskCard).toBeVisible({ timeout: 10000 });

        // confirm dialog を受け入れる
        page.on("dialog", async (dialog) => dialog.accept());

        await taskCard.getByRole("button", { name: /削除/ }).click();

        // タスクが削除されていることを確認
        await expect(taskCard).not.toBeVisible({ timeout: 10000 });
    });
});
