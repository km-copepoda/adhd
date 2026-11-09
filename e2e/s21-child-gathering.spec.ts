/**
 * S21: ひろば（gathering）参加フォーム
 * 前提: as-child プロジェクト（storageState: child-light.json）で実行
 *
 * 毎回 beforeEach で「退出」してから画面を開くので、常に未参加の状態から始まる（Issue #221）。
 * 他のテストや --repeat-each の前回実行で参加状態が残っていても影響しない。
 *
 * - /app/child/gathering が表示される
 * - 未参加：場所選択（こうえん/じどうかん/がっこう）と合言葉入力が表示される
 * - 境界値：合言葉なしで「あつまる！」を押すとエラー
 */
import { test, expect } from "./fixtures";
import { leaveGatheringIfJoined, openSessions, type Sessions } from "./helpers/testData";

test.describe("S21: ひろば", () => {
  let sessions: Sessions;

  test.beforeEach(async ({ page }) => {
    sessions = await openSessions();
    // 前のテストの後始末（退出）を先に行ってから画面を開く
    await leaveGatheringIfJoined(sessions.childReq);
    await page.goto("/app/child/gathering");
    await expect(page.getByRole("heading", { name: /ひろば/ })).toBeVisible({
      timeout: 15000,
    });
  });

  test.afterEach(async () => {
    await sessions?.dispose();
  });

  test("見出し「🏕️ ひろば」が表示される", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /ひろば/ })).toBeVisible();
  });

  test("未参加なので参加フォームが表示される", async ({ page }) => {
    await expect(page.getByRole("button", { name: /あつまる！/ })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("button", { name: /ぬける/ })).toHaveCount(0);
  });

  test("参加フォームでは場所3種と合言葉入力が表示される", async ({ page }) => {
    await expect(page.getByRole("button", { name: /あつまる！/ })).toBeVisible();
    // 場所ボタン3種類
    await expect(page.getByRole("button", { name: /こうえん|公園/ })).toBeVisible();
    await expect(page.locator('input[placeholder="れいんぼー"]')).toBeVisible();
  });

  test("境界値: 合言葉未入力で「あつまる！」を押すとエラーが表示される", async ({ page }) => {
    const joinBtn = page.getByRole("button", { name: /あつまる！/ });
    await expect(joinBtn).toBeVisible();
    await joinBtn.click();
    await expect(page.getByText("合言葉を入れてね")).toBeVisible({ timeout: 5000 });
  });
});
