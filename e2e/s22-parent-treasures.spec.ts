/**
 * S22: 親の宝箱プール（ごほうび）設定ページ
 * 前提: as-parent プロジェクト（storageState: parent.json）で実行
 *
 * - /app/parent/treasures が表示される（タブ切替）
 * - 「ごほうび設定」見出しと「もらった履歴」タブが表示される
 * - 子供セレクター（QA_child）が表示される
 * - 新しいごほうび追加フォーム（タイトル入力 + レア度 + 「追加」ボタン）
 * - 境界値: タイトル未入力では「追加」ボタンが無効
 * - 既存ごほうびがあれば一覧、なければ「おすすめセットで始める」ボタン
 */
import { test, expect } from "./fixtures";

test.describe("S22: 親のごほうび設定", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/app/parent/treasures");
    await expect(page.getByRole("heading", { name: /ごほうび設定/ })).toBeVisible({
      timeout: 15000,
    });
  });

  test("見出しとタブ（設定・もらった履歴）が表示される", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /ごほうび設定/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /⚙️ 設定/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /🎁 もらった履歴/ })).toBeVisible();
  });

  test("対象の子供セレクターが表示される", async ({ page }) => {
    await expect(page.getByText("対象の子供")).toBeVisible();
    await expect(page.locator("select").first()).toBeVisible();
  });

  test("「新しいごほうびを追加」フォームが表示される", async ({ page }) => {
    await expect(page.getByText("新しいごほうびを追加")).toBeVisible();
    await expect(page.locator('input[placeholder="例: アイスを買える"]')).toBeVisible();
    await expect(page.getByRole("button", { name: /^追加$/ })).toBeVisible();
  });

  test("境界値: タイトル未入力では「追加」ボタンが無効", async ({ page }) => {
    await expect(page.getByRole("button", { name: /^追加$/ })).toBeDisabled();
  });

  test("境界値: タイトル空白のみでは「追加」ボタンが無効", async ({ page }) => {
    await page.fill('input[placeholder="例: アイスを買える"]', "   ");
    await expect(page.getByRole("button", { name: /^追加$/ })).toBeDisabled();
  });

  test("レア度プルダウンに3種類（よく出る/ときどき/たまに）の選択肢がある", async ({ page }) => {
    // フォーム内 select の option 文字列で検証
    const raritySelect = page.locator('select').nth(1);
    await expect(raritySelect).toBeVisible();
    const optionTexts = await raritySelect.locator("option").allTextContents();
    expect(optionTexts).toContain("よく出る");
    expect(optionTexts).toContain("ときどき");
    expect(optionTexts).toContain("たまに");
  });

  test("ごほうびを追加すると一覧に表示される", async ({ page }) => {
    const title = `E2E_ごほうび_${Date.now()}`;
    await page.fill('input[placeholder="例: アイスを買える"]', title);
    await page.getByRole("button", { name: /^追加$/ }).click();

    // 一覧に新しく追加されたアイテムが表示される
    await expect(page.getByText(title)).toBeVisible({ timeout: 10000 });
    // 入力欄はクリアされる
    await expect(page.locator('input[placeholder="例: アイスを買える"]')).toHaveValue("");
  });

  test("追加したごほうびを削除できる", async ({ page }) => {
    const title = `E2E_削除対象_${Date.now()}`;
    await page.fill('input[placeholder="例: アイスを買える"]', title);
    await page.getByRole("button", { name: /^追加$/ }).click();
    await expect(page.getByText(title)).toBeVisible({ timeout: 10000 });

    // 該当行の削除ボタンをクリック
    const row = page.locator("li").filter({ hasText: title });
    page.on("dialog", (d) => d.accept());
    await row.getByRole("button", { name: /^削除$/ }).click();

    await expect(page.getByText(title)).not.toBeVisible({ timeout: 10000 });
  });
});
