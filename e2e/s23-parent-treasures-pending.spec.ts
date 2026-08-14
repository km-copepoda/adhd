/**
 * S23: 親「もらった履歴」ページ — 親メモ「渡したよチェック」
 * 前提: as-parent-premium プロジェクト（storageState: parent.json）で実行
 *
 * - /app/parent/treasures/pending が表示される
 * - 「もらったごほうび」見出しと、設定タブとの切替リンクが表示される
 * - 履歴がない場合「まだもらったごほうびはありません。」が表示される
 * - 履歴がある場合、各行に「渡した」または「取り消し」ボタンが表示される
 *
 * decisions.md 2026-05-31「渡したよチェック」を親メモとして復活。
 */
import { test, expect } from "./fixtures";

test.describe("S23: 親 もらった履歴（渡したよチェック）", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/app/parent/treasures/pending");
    await expect(page.getByRole("heading", { name: /もらったごほうび/ })).toBeVisible({
      timeout: 15000,
    });
  });

  test("見出し「🎁 もらったごほうび」とタブが表示される", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /もらったごほうび/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /⚙️ 設定/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /🎁 もらった履歴/ })).toBeVisible();
  });

  test("「設定」リンクが /app/parent/treasures に向いている", async ({ page }) => {
    const settingsLink = page.getByRole("link", { name: /⚙️ 設定/ });
    await expect(settingsLink).toHaveAttribute("href", /\/app\/parent\/treasures$/);
  });

  test("履歴が空のときの案内文が表示される、または履歴行が表示される", async ({ page }) => {
    const empty = page.getByText("まだもらったごほうびはありません。");
    const anyRow = page.locator("li").filter({ hasText: /渡し済み|まだ渡してない/ });
    await expect(empty.or(anyRow.first())).toBeVisible({ timeout: 10000 });
  });

  test("履歴行があれば「渡した」または「取り消し」ボタンが表示される", async ({ page }) => {
    const empty = page.getByText("まだもらったごほうびはありません。");
    if (await empty.isVisible()) {
      test.skip(true, "履歴が空のためスキップ");
      return;
    }
    // ステータステキスト
    const status = page.getByText(/渡し済み|まだ渡してない/).first();
    await expect(status).toBeVisible();
    // トグルボタン
    const toggle = page.getByRole("button", { name: /^渡した$|^取り消し$/ }).first();
    await expect(toggle).toBeVisible();
  });

  test("子画面側には fulfilled が露出しない（親メモ専用の確認）", async ({ page }) => {
    // この URL はそもそも親専用。子供アカウントは middleware で弾かれる。
    // ここでは親ページに「渡したよチェックは子供には見えません」案内文の有無を確認。
    await expect(page.getByText(/このチェックは子供には見えません/)).toBeVisible();
  });
});
