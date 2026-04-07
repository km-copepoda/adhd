/**
 * S9: 子供ユーザー管理（作成・ログイン確認・削除）
 * 前提: as-parent プロジェクトで実行（storageState: parent.json）
 *
 * - ファミリー管理ページが表示される
 * - 境界値: 名前未入力では追加ボタン押下時エラーが表示される
 * - 子供ユーザーを作成できる（ユーザーコードがリストに表示される）
 * - 作成した子供がユーザーコードでログインできる
 * - 子供ユーザーを削除できる
 */
import { test, expect } from "./fixtures";
import path from "path";
import { readCredentials, VERCEL_HOSTNAME, createBrowserContext } from "./credentials";

const CHILD_AUTH_PATH = path.join(process.cwd(), "playwright/.auth/child-light.json");

test.describe("S9: 子供ユーザー管理", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/app/parent/family");
    await expect(page.getByRole("heading", { name: /ファミリー管理/ })).toBeVisible({
      timeout: 15000,
    });
  });

  test("ファミリー管理ページが正しく表示される", async ({ page }) => {
    await expect(page.getByText("ファミリーコード", { exact: true })).toBeVisible();
    await expect(page.getByText("メンバー")).toBeVisible();
    await expect(page.getByRole("button", { name: /子どもを追加/ })).toBeVisible();
  });

  test("境界値: 名前未入力で追加ボタンを押すとエラーが表示される", async ({ page }) => {
    await page.getByRole("button", { name: /子どもを追加/ }).click();
    await expect(page.locator('input[placeholder="例: りゅうくん"]')).toBeVisible();

    // 名前を入力せず追加ボタンをクリック
    await page.getByRole("button", { name: /^追加$/ }).click();

    // エラーメッセージが表示される
    await expect(page.getByText("名前を入力してください")).toBeVisible();
  });

  test("キャンセルボタンで追加フォームが閉じる", async ({ page }) => {
    await page.getByRole("button", { name: /子どもを追加/ }).click();
    await expect(page.locator('input[placeholder="例: りゅうくん"]')).toBeVisible();

    await page.getByRole("button", { name: /キャンセル/ }).click();

    await expect(page.locator('input[placeholder="例: りゅうくん"]')).not.toBeVisible();
  });

  test("子供ユーザーを作成しログインし削除できる", async ({ page, browser }) => {
    const childName = `E2E_${Date.now()}`;

    // --- 1. 子供ユーザーを作成 ---
    await page.getByRole("button", { name: /子どもを追加/ }).click();
    await expect(page.locator('input[placeholder="例: りゅうくん"]')).toBeVisible();

    await page.fill('input[placeholder="例: りゅうくん"]', childName);

    // ライトサイドを選択
    await page.getByRole("button", { name: /ライト/ }).click();

    await page.getByRole("button", { name: /^追加$/ }).click();

    // --- 2. 作成した子供がリストに表示されることを確認 ---
    await expect(page.getByText(childName)).toBeVisible({ timeout: 10000 });

    // --- 3. ユーザーコードを取得 ---
    // 該当の子供カードを特定し font-mono 要素からコードを取得
    const memberRow = page
      .locator(".bg-quest-bg.rounded-lg")
      .filter({ hasText: childName });
    await expect(memberRow).toBeVisible();

    const childCode = await memberRow.locator(".font-mono").textContent();
    expect(childCode).toBeTruthy();
    expect(childCode!.trim()).toMatch(/^\d{4}$/);

    // --- 4. 新しいコンテキストで子供ログインをテスト ---
    // 親セッションのまま /app/child/login に遷移するとミドルウェアが /app/parent/tasks にリダイレクトするため、
    // 認証なしの新コンテキストを作成してテストする
    const { familyCode } = readCredentials();
    const { context: childContext, page: childPage } = await createBrowserContext(browser);

    try {
      await childPage.goto(`https://${VERCEL_HOSTNAME}/app/child/login`);
      await expect(childPage.locator('input[placeholder="ABC123"]')).toBeVisible({
        timeout: 15000,
      });

      await childPage.fill('input[placeholder="ABC123"]', familyCode);
      await childPage.fill('input[placeholder="1234"]', childCode!.trim());
      await childPage.click('button:has-text("ログイン")');

      await expect(childPage).toHaveURL(/\/child\/quests/, { timeout: 15000 });
    } finally {
      await childContext.close();
    }

    // --- 5. 子供ユーザーを削除 ---
    // 削除ボタン（一段階目: 確認ダイアログ表示）をクリック
    await memberRow.getByRole("button", { name: /^削除$/ }).click();

    // 確認ダイアログが表示される
    await expect(memberRow.getByText("本当に削除？")).toBeVisible();

    // 削除を確定（二段階目）
    await memberRow.getByRole("button", { name: /^削除$/ }).click();

    // 子供がリストから消えることを確認
    await expect(page.getByText(childName)).not.toBeVisible({ timeout: 10000 });
  });
});
