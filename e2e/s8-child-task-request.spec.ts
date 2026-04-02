/**
 * S8: 子供自身によるタスク申請フロー
 * 前提: as-child プロジェクト（storageState: child-light.json）で実行
 *
 * - 「+ タスクを追加」ボタンでフォームが開く
 * - 一時タスク（今日だけ）を申請できる
 * - 通常タスク（繰り返し）を申請できる
 * - 申請後クエストリストに「仮」バッジ付きで表示される
 * - 境界値: タイトル未入力では「追加する」ボタンが無効
 */
import { test, expect } from "@playwright/test";

test.describe("S8: 子供タスク申請", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/child/quests");
    await expect(page.getByRole("heading", { name: /今日のクエスト/ })).toBeVisible({
      timeout: 15000,
    });
  });

  test("「+ タスクを追加」ボタンが表示される", async ({ page }) => {
    await expect(page.getByRole("button", { name: /タスクを追加/ })).toBeVisible();
  });

  test("「+ タスクを追加」クリックでフォームが展開される", async ({ page }) => {
    await page.getByRole("button", { name: /タスクを追加/ }).click();

    // フォームが表示される
    await expect(page.locator('input[placeholder="タスク名を入力..."]')).toBeVisible();
    await expect(page.getByRole("button", { name: /一時タスク/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /通常タスク/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /追加する/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /キャンセル/ })).toBeVisible();
  });

  test("境界値: タイトル未入力では「追加する」ボタンが無効", async ({ page }) => {
    await page.getByRole("button", { name: /タスクを追加/ }).click();
    await expect(page.locator('input[placeholder="タスク名を入力..."]')).toBeVisible();

    // タイトル空の状態では無効
    await expect(page.getByRole("button", { name: /追加する/ })).toBeDisabled();
  });

  test("境界値: タイトルが空白のみでは「追加する」ボタンが無効", async ({ page }) => {
    await page.getByRole("button", { name: /タスクを追加/ }).click();
    await page.fill('input[placeholder="タスク名を入力..."]', "   ");
    await expect(page.getByRole("button", { name: /追加する/ })).toBeDisabled();
  });

  test("一時タスクを申請するとクエストリストに「仮」バッジで表示される", async ({ page }) => {
    const title = `E2E子供一時タスク_${Date.now()}`;

    await page.getByRole("button", { name: /タスクを追加/ }).click();

    // 一時タスクモードを選択（デフォルトが一時タスク）
    await page.getByRole("button", { name: /一時タスク/ }).click();

    await page.fill('input[placeholder="タスク名を入力..."]', title);
    await expect(page.getByRole("button", { name: /追加する/ })).toBeEnabled();

    await page.getByRole("button", { name: /追加する/ }).click();

    // フォームが閉じてリストに追加される
    await expect(page.locator('input[placeholder="タスク名を入力..."]')).not.toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText(title)).toBeVisible({ timeout: 10000 });

    // 「仮」バッジが表示される
    const taskCard = page.locator(".bg-quest-card").filter({ hasText: title });
    await expect(taskCard.getByText("仮")).toBeVisible();
  });

  test("通常タスクを申請するとクエストリストに「仮」バッジで表示される", async ({ page }) => {
    const title = `E2E子供通常タスク_${Date.now()}`;

    await page.getByRole("button", { name: /タスクを追加/ }).click();

    // 通常タスクモードに切り替え
    await page.getByRole("button", { name: /通常タスク/ }).click();
    await expect(page.getByText("毎週繰り返す自分のタスクを追加します")).toBeVisible();

    await page.fill('input[placeholder="タスク名を入力..."]', title);
    await expect(page.getByRole("button", { name: /追加する/ })).toBeEnabled();

    await page.getByRole("button", { name: /追加する/ }).click();

    await expect(page.locator('input[placeholder="タスク名を入力..."]')).not.toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText(title)).toBeVisible({ timeout: 10000 });

    // 「仮」バッジが表示される
    const taskCard = page.locator(".bg-quest-card").filter({ hasText: title });
    await expect(taskCard.getByText("仮")).toBeVisible();
  });

  test("キャンセルボタンでフォームが閉じる", async ({ page }) => {
    await page.getByRole("button", { name: /タスクを追加/ }).click();
    await expect(page.locator('input[placeholder="タスク名を入力..."]')).toBeVisible();

    await page.getByRole("button", { name: /キャンセル/ }).click();
    await expect(page.locator('input[placeholder="タスク名を入力..."]')).not.toBeVisible();
  });

  test("カテゴリ選択ボタンが3種類表示される（勉強・体力・生活）", async ({ page }) => {
    await page.getByRole("button", { name: /タスクを追加/ }).click();

    // 3つのカテゴリボタンが表示される
    await expect(page.getByRole("button", { name: /勉強|📚/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /体力|🏃/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /生活|🏠|🌟/ })).toBeVisible();
  });
});
