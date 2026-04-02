/**
 * S6: 親クエスト承認フロー
 * 前提: as-parent プロジェクト（storageState: parent.json）で実行
 *
 * - /parent/approve が表示される
 * - 承認待ちのクエストカードが表示される
 * - クエストカードクリック（= 承認）でリストから消える
 * - 「まとめて承認」ボタンが動作する
 * - 差し戻しモーダルが開く
 * - 境界値: 理由未選択では「差し戻す」ボタンが無効
 */
import { test, expect } from "./fixtures";

test.describe("S6: 親クエスト承認", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/parent/approve");
    await expect(page.getByRole("heading", { name: /承認センター/ })).toBeVisible({
      timeout: 15000,
    });
  });

  test("承認センターページが表示される", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /承認センター/ })).toBeVisible();
    // 件数テキストが表示される（0件 or N件）
    await expect(page.getByText(/件の報告が承認待ちです/)).toBeVisible();
  });

  test("承認待ちがない場合は「承認待ちの報告はありません」と表示される", async ({ page }) => {
    const quests = page.locator(".bg-quest-card.border.rounded-xl.cursor-pointer");
    const count = await quests.count();

    if (count === 0) {
      await expect(page.getByText("承認待ちの報告はありません")).toBeVisible();
    } else {
      // 承認待ちがある場合はカードが表示される
      await expect(quests.first()).toBeVisible();
    }
  });

  test("承認待ちクエストカードをクリックすると承認される", async ({ page }) => {
    const quests = page.locator(".bg-quest-card.border.rounded-xl.p-5.cursor-pointer");
    const count = await quests.count();

    if (count === 0) {
      test.skip(true, "承認待ちクエストがないためスキップ");
      return;
    }

    const initialCount = count;
    // クエストカードをクリック（= 承認）
    await quests.first().click();

    // カードが減ることを確認
    await expect(quests).toHaveCount(initialCount - 1, { timeout: 10000 });
  });

  test("承認待ちが複数ある場合、「まとめて承認」ボタンが表示される", async ({ page }) => {
    const quests = page.locator(".bg-quest-card.border.rounded-xl.p-5.cursor-pointer");
    const count = await quests.count();

    if (count === 0) {
      test.skip(true, "承認待ちクエストがないためスキップ");
      return;
    }

    await expect(page.getByRole("button", { name: /まとめて承認/ })).toBeVisible();
  });

  test("差し戻しボタンで差し戻しモーダルが開く", async ({ page }) => {
    const quests = page.locator(".bg-quest-card.border.rounded-xl.p-5.cursor-pointer");
    const count = await quests.count();

    if (count === 0) {
      test.skip(true, "承認待ちクエストがないためスキップ");
      return;
    }

    // 「差し戻し」ボタンをクリック（カードクリックとは別のボタン）
    await page.getByRole("button", { name: /差し戻し/ }).first().click();

    // 差し戻しモーダルが表示される
    await expect(page.getByText("差し戻し理由を選んでください")).toBeVisible();
    await expect(page.getByRole("button", { name: /差し戻す/ })).toBeVisible();
  });

  test("境界値: 差し戻しモーダルで理由未選択は「差し戻す」が無効", async ({ page }) => {
    const quests = page.locator(".bg-quest-card.border.rounded-xl.p-5.cursor-pointer");
    const count = await quests.count();

    if (count === 0) {
      test.skip(true, "承認待ちクエストがないためスキップ");
      return;
    }

    await page.getByRole("button", { name: /差し戻し/ }).first().click();
    await expect(page.getByText("差し戻し理由を選んでください")).toBeVisible();

    // 理由を選択していないと「差し戻す」は disabled
    await expect(page.getByRole("button", { name: /差し戻す/ })).toBeDisabled();
  });

  test("差し戻しモーダルはキャンセルで閉じる", async ({ page }) => {
    const quests = page.locator(".bg-quest-card.border.rounded-xl.p-5.cursor-pointer");
    const count = await quests.count();

    if (count === 0) {
      test.skip(true, "承認待ちクエストがないためスキップ");
      return;
    }

    await page.getByRole("button", { name: /差し戻し/ }).first().click();
    await expect(page.getByText("差し戻し理由を選んでください")).toBeVisible();

    await page.getByRole("button", { name: /キャンセル/ }).click();
    await expect(page.getByText("差し戻し理由を選んでください")).not.toBeVisible();
  });

  test("スキップ申請カードは赤系UIで表示される", async ({ page }) => {
    // SKIP_REPORTED なクエストがあれば赤枠で表示されることを確認
    const skipCard = page.locator(".border-red-400\\/20").first();
    const count = await skipCard.count();

    if (count === 0) {
      test.skip(true, "スキップ申請がないためスキップ");
      return;
    }

    await expect(skipCard).toBeVisible();
    await expect(skipCard.getByText(/スキップを承認/)).toBeVisible();
  });
});
