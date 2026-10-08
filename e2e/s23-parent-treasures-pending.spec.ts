/**
 * S23: 親「もらった履歴」ページ — ごほうび使用の承認/取り消し
 * 前提: as-parent-premium プロジェクト（storageState: parent.json）で実行
 *
 * - /app/parent/treasures/pending が表示される
 * - 「もらったごほうび」見出しと、設定タブとの切替リンクが表示される
 * - 履歴がない場合「まだもらったごほうびはありません。」が表示される
 * - 履歴がある場合、各行に状態（未使用/使用申請中/使用済み）が表示され、
 *   使用済み行にのみ「使用を取り消す」ボタンが表示される
 *
 * Issue #151: ごほうび使用を親承認フロー化（申請 → 承認センターで承認/却下、
 * 承認後の取り消しはこのページから）。decisions.md 2026-05-31 の
 * 「渡したよチェック」（親子共有の単一トグル）は本Issueで置き換え済み。
 */
import { test, expect } from "./fixtures";

test.describe("S23: 親 もらった履歴（ごほうび使用承認）", () => {
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
    const anyRow = page.locator("li").filter({ hasText: /使用済み|使用申請中|未使用/ });
    await expect(empty.or(anyRow.first())).toBeVisible({ timeout: 10000 });
  });

  test("履歴行の状態表示と、使用済み行にのみ「使用を取り消す」ボタンが表示される", async ({ page }) => {
    const empty = page.getByText("まだもらったごほうびはありません。");
    const anyRow = page.locator("li").filter({ hasText: /使用済み|使用申請中|未使用/ });
    await expect(empty.or(anyRow.first())).toBeVisible({ timeout: 10000 });

    if (await empty.isVisible()) {
      test.skip(true, "履歴が空のためスキップ");
      return;
    }
    // ステータステキスト
    const status = page.getByText(/使用済み|使用申請中|未使用/).first();
    await expect(status).toBeVisible();

    // 使用済み行には「使用を取り消す」ボタンがある
    const usedRows = page.locator("li").filter({ hasText: "使用済み" });
    if ((await usedRows.count()) > 0) {
      await expect(usedRows.first().getByRole("button", { name: "使用を取り消す" })).toBeVisible();
    }

    // 未使用・使用申請中の行にはボタンが無い（承認/却下は承認センターの責務）
    const notUsedRows = page.locator("li").filter({ hasText: /使用申請中|未使用/ });
    if ((await notUsedRows.count()) > 0) {
      await expect(notUsedRows.first().locator("button")).toHaveCount(0);
    }
  });

  test("使用申請フローの説明文が表示される（Issue #151）", async ({ page }) => {
    // Issue #151: 「渡したよ」トグルから承認フローに一本化。旧説明文は撤去済み。
    await expect(
      page.getByText(/子供が「つかう」を申請すると承認センターに届き/),
    ).toBeVisible();
    await expect(page.getByText(/このチェックは子供の画面と共有され/)).toHaveCount(0);
  });
});
