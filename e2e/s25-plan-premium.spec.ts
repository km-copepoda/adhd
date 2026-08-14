/**
 * S25: PREMIUM プランで各種上限を超えられることの検証
 * 前提: as-parent-premium プロジェクト（storageState: parent.json）で実行
 * PREMIUM アカウントの認証情報は e2e/credentials.ts の readCredentials() で取得できるが、
 * QA_child / QA_child2 は他の PREMIUM 系 spec（s9, s10, s12, s13, s16-s18, s22, s23）と
 * 件数・状態を共有しているため、このファイルでは各テストごとに専用の子供を
 * API 経由で新規作成して使う（既存 spec の前提を壊さないため）。
 *
 * src/lib/subscription.ts の checkLimit / checkBulkLimit は PREMIUM の LIMITS が
 * すべて null（無制限）のため常に allowed=true を返す。したがって以下のテストでは
 * 「エラー（alert / インラインエラー）が出ずに一覧へ反映されること」を確認することで
 * 上限を超えられることを検証する。
 *
 * - タスク上限（10件/子, FREE）: 11件目を追加してもエラーにならず一覧に反映される
 * - ごほうび上限（5件/子, FREE）: 6件目を追加してもエラーにならず一覧に反映される
 * - 「おすすめセットで始める」ボタンは PREMIUM では表示され、20件インポートできる
 * - タスク上限を超えた状態でも一時停止中タスクをエラーなく再開できる
 */
import { test, expect } from "./fixtures";
import { getBypassHeaders } from "./credentials";

test.describe("S25: PREMIUM プラン上限", () => {
  test("タスク11件目を追加できる", async ({ page }) => {
    const bypassHeaders = getBypassHeaders();
    const childName = `E2E_S25_task_${Date.now()}`;

    const childRes = await page.request.post("/api/family/members", {
      data: { monsterName: childName, side: "LIGHT" },
      headers: bypassHeaders,
    });
    expect(childRes.ok()).toBeTruthy();
    const child = await childRes.json();

    // API 経由で事前に10件作成（FREE 上限ちょうど）
    for (let i = 0; i < 10; i++) {
      const res = await page.request.post("/api/tasks", {
        data: {
          title: `E2E_S25_task_${Date.now()}_${i}`,
          emoji: "📚",
          category: "STUDY",
          repeatDays: [0, 1, 2, 3, 4, 5, 6],
          isTemporary: false,
          assignedChildId: child.id,
        },
        headers: bypassHeaders,
      });
      expect(res.ok()).toBeTruthy();
    }

    await page.goto("/app/parent/tasks");
    await expect(page.getByRole("heading", { name: /タスク管理/ })).toBeVisible({
      timeout: 15000,
    });

    // 複数の子供がいるため子供切替ボタンで今回作成した子供を選択する
    await page.getByRole("button", { name: new RegExp(childName) }).click();

    const dialogMessages: string[] = [];
    page.on("dialog", async (dialog) => {
      dialogMessages.push(dialog.message());
      await dialog.dismiss();
    });

    await page.getByRole("button", { name: /タスク追加/ }).first().click();
    await expect(page.locator('input[placeholder="例: 算数ドリルをやる"]')).toBeVisible();
    const newTaskTitle = `E2E_S25_task_over_${Date.now()}`;
    await page.fill('input[placeholder="例: 算数ドリルをやる"]', newTaskTitle);
    await page.getByRole("button", { name: /^作成$/ }).click();

    // PREMIUM のため上限エラーは出ず、11件目が一覧に反映される
    await expect(page.getByText(newTaskTitle)).toBeVisible({ timeout: 10000 });
    expect(dialogMessages).toEqual([]);
  });

  test("ごほうび6件目を追加できる", async ({ page }) => {
    const bypassHeaders = getBypassHeaders();
    const childName = `E2E_S25_treasure_${Date.now()}`;

    const childRes = await page.request.post("/api/family/members", {
      data: { monsterName: childName, side: "LIGHT" },
      headers: bypassHeaders,
    });
    expect(childRes.ok()).toBeTruthy();
    const child = await childRes.json();

    // API 経由で事前に5件作成（FREE 上限ちょうど）
    for (let i = 0; i < 5; i++) {
      const res = await page.request.post("/api/treasures", {
        data: {
          childId: child.id,
          title: `E2E_S25_treasure_${Date.now()}_${i}`,
          rarity: "COMMON",
        },
        headers: bypassHeaders,
      });
      expect(res.ok()).toBeTruthy();
    }

    await page.goto("/app/parent/treasures");
    await expect(page.getByRole("heading", { name: /ごほうび設定/ })).toBeVisible({
      timeout: 15000,
    });

    // 複数の子供がいるため子供切替ボタンで今回作成した子供を選択する
    await page.getByRole("button", { name: new RegExp(childName) }).click();

    const dialogMessages: string[] = [];
    page.on("dialog", async (dialog) => {
      dialogMessages.push(dialog.message());
      await dialog.dismiss();
    });

    const newTitle = `E2E_S25_treasure_over_${Date.now()}`;
    await page.fill('input[placeholder="例: アイスを買える"]', newTitle);
    await page.getByRole("button", { name: /^追加$/ }).click();

    // PREMIUM のため上限エラーは出ず、6件目が一覧に反映される
    await expect(page.getByText(newTitle)).toBeVisible({ timeout: 10000 });
    expect(dialogMessages).toEqual([]);
  });

  test("「おすすめセットで始める」ボタンが表示され、20件インポートできる", async ({ page }) => {
    const bypassHeaders = getBypassHeaders();
    const childName = `E2E_S25_import_${Date.now()}`;

    const childRes = await page.request.post("/api/family/members", {
      data: { monsterName: childName, side: "LIGHT" },
      headers: bypassHeaders,
    });
    expect(childRes.ok()).toBeTruthy();

    await page.goto("/app/parent/treasures");
    await expect(page.getByRole("heading", { name: /ごほうび設定/ })).toBeVisible({
      timeout: 15000,
    });

    // 複数の子供がいるため子供切替ボタンで今回作成した子供（ごほうび0件）を選択する
    await page.getByRole("button", { name: new RegExp(childName) }).click();
    await expect(page.getByText("まだごほうびが登録されていません。")).toBeVisible({
      timeout: 10000,
    });

    // FREE では非表示だが PREMIUM では「おすすめセットで始める」ボタンが表示される
    const importButton = page.getByRole("button", { name: /おすすめセットで始める/ });
    await expect(importButton).toBeVisible();

    const dialogMessages: string[] = [];
    page.on("dialog", async (dialog) => {
      dialogMessages.push(dialog.message());
      await dialog.accept();
    });

    await importButton.click();

    // 20件のテンプレートがエラーなく一覧に反映される
    await expect(page.getByText("おやつをひとつ選べる")).toBeVisible({ timeout: 15000 });
    await expect(page.locator("li")).toHaveCount(20, { timeout: 15000 });
    // 表示されたダイアログは投入前の確認ダイアログのみ（エラーダイアログは出ない）
    expect(dialogMessages).toEqual([
      "おすすめのごほうび20件をプールに追加します。よろしいですか？",
    ]);
  });

  test("上限到達状態のタスクを一時停止から再開できる", async ({ page }) => {
    const bypassHeaders = getBypassHeaders();
    const childName = `E2E_S25_pause_${Date.now()}`;

    const childRes = await page.request.post("/api/family/members", {
      data: { monsterName: childName, side: "LIGHT" },
      headers: bypassHeaders,
    });
    expect(childRes.ok()).toBeTruthy();
    const child = await childRes.json();

    // API 経由で11件作成（FREE 上限を超える件数）
    const taskIds: string[] = [];
    for (let i = 0; i < 11; i++) {
      const res = await page.request.post("/api/tasks", {
        data: {
          title: `E2E_S25_pausetask_${Date.now()}_${i}`,
          emoji: "📚",
          category: "STUDY",
          repeatDays: [0, 1, 2, 3, 4, 5, 6],
          isTemporary: false,
          assignedChildId: child.id,
        },
        headers: bypassHeaders,
      });
      expect(res.ok()).toBeTruthy();
      const data = await res.json();
      taskIds.push(data.id);
    }

    // 1件を一時停止（active数が10件＝FREE上限ちょうどに戻る）
    const targetTaskId = taskIds[0];
    const pauseRes = await page.request.post(`/api/tasks/${targetTaskId}/pause`, {
      data: { paused: true },
      headers: bypassHeaders,
    });
    expect(pauseRes.ok()).toBeTruthy();

    await page.goto("/app/parent/tasks");
    await expect(page.getByRole("heading", { name: /タスク管理/ })).toBeVisible({
      timeout: 15000,
    });
    await page.getByRole("button", { name: new RegExp(childName) }).click();

    await expect(page.getByText("⏸ 停止中")).toBeVisible({ timeout: 10000 });

    const dialogMessages: string[] = [];
    page.on("dialog", async (dialog) => {
      dialogMessages.push(dialog.message());
      await dialog.dismiss();
    });

    // 再開するとactiveタスクが11件（FREE上限10件を超える）になるが、
    // PREMIUM のため上限チェックに引っかからずエラーなく再開が完了する
    const pausedCard = page.locator(".bg-quest-card").filter({ hasText: "⏸ 停止中" });
    await pausedCard.getByRole("button", { name: /再開/ }).click();

    await expect(page.getByText("⏸ 停止中")).not.toBeVisible({ timeout: 10000 });
    expect(dialogMessages).toEqual([]);
  });
});
