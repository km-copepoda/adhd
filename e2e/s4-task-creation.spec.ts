/**
 * S4: 親タスク作成（通常タスク & 一時タスク）
 * 前提: as-parent プロジェクトで実行（storageState: parent.json）
 *
 * - タスク管理ページが表示される
 * - 通常タスクを作成できる
 * - 一時タスクを作成できる
 * - 境界値: タイトル未入力では作成ボタンが無効
 */
import { test, expect } from "@playwright/test";

test.describe("S4: 親タスク管理", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/parent/tasks");
    await expect(page.getByRole("heading", { name: /タスク管理/ })).toBeVisible({
      timeout: 15000,
    });
  });

  test("タスク管理ページが正しく表示される", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /タスク管理/ })).toBeVisible();
    await expect(page.getByText("定期クエストの作成・編集")).toBeVisible();
  });

  test("子供がいる場合、タスク追加ボタンが表示される", async ({ page }) => {
    // 子供が少なくとも1人いれば「+ タスク追加」ボタンが表示される
    const addButton = page.getByRole("button", { name: /タスク追加/ }).first();
    await expect(addButton).toBeVisible();
  });

  test("通常タスクを作成できる", async ({ page }) => {
    const title = `E2Eテスト通常タスク_${Date.now()}`;

    // タスク追加フォームを開く
    await page.getByRole("button", { name: /タスク追加/ }).first().click();
    await expect(page.locator('input[placeholder="例: 算数ドリルをやる"]')).toBeVisible();

    // 通常タスクタブを確認（デフォルトが通常タスク）
    await expect(page.getByRole("button", { name: /通常タスク/ })).toBeVisible();

    // タイトルを入力
    await page.fill('input[placeholder="例: 算数ドリルをやる"]', title);

    // カテゴリ「勉強」を選択（デフォルト）
    // 作成ボタンが有効になる
    const createButton = page.getByRole("button", { name: /^作成$/ });
    await expect(createButton).toBeEnabled();

    // 作成
    await createButton.click();

    // フォームが閉じてタスクリストに追加されることを確認
    await expect(page.locator('input[placeholder="例: 算数ドリルをやる"]')).not.toBeVisible();
    await expect(page.getByText(title)).toBeVisible({ timeout: 10000 });
  });

  test("一時タスクを作成できる", async ({ page }) => {
    const title = `E2E一時タスク_${Date.now()}`;

    await page.getByRole("button", { name: /タスク追加/ }).first().click();
    await expect(page.locator('input[placeholder="例: 算数ドリルをやる"]')).toBeVisible();

    // 一時タスクタブに切り替え
    await page.getByRole("button", { name: /一時タスク/ }).click();
    await expect(page.getByText(/に一時タスクを追加/)).toBeVisible();

    // タイトルを入力
    await page.fill('input[placeholder="例: 算数ドリルをやる"]', title);

    const createButton = page.getByRole("button", { name: /^作成$/ });
    await expect(createButton).toBeEnabled();
    await createButton.click();

    await expect(page.locator('input[placeholder="例: 算数ドリルをやる"]')).not.toBeVisible();
    await expect(page.getByText(title)).toBeVisible({ timeout: 10000 });
  });

  test("境界値: タイトル未入力では作成ボタンが無効になる", async ({ page }) => {
    await page.getByRole("button", { name: /タスク追加/ }).first().click();
    await expect(page.locator('input[placeholder="例: 算数ドリルをやる"]')).toBeVisible();

    // タイトルが空の状態（デフォルト）では作成ボタンが無効
    const createButton = page.getByRole("button", { name: /^作成$/ });
    await expect(createButton).toBeDisabled();
  });

  test("境界値: タイトルが空白のみでは作成ボタンが無効になる", async ({ page }) => {
    await page.getByRole("button", { name: /タスク追加/ }).first().click();
    await page.fill('input[placeholder="例: 算数ドリルをやる"]', "   ");

    const createButton = page.getByRole("button", { name: /^作成$/ });
    await expect(createButton).toBeDisabled();
  });

  test("キャンセルボタンでフォームが閉じる", async ({ page }) => {
    await page.getByRole("button", { name: /タスク追加/ }).first().click();
    await expect(page.locator('input[placeholder="例: 算数ドリルをやる"]')).toBeVisible();

    await page.getByRole("button", { name: /キャンセル/ }).click();
    await expect(page.locator('input[placeholder="例: 算数ドリルをやる"]')).not.toBeVisible();
  });
});
