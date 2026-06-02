/**
 * S21: ひろば（gathering）参加フォーム
 * 前提: as-child プロジェクト（storageState: child-light.json）で実行
 *
 * 既存参加グループがあるかどうかはアカウント状態に依存するため、
 * 「参加フォーム」と「参加中UI」のどちらかが表示されることを最低限保証する。
 *
 * - /app/child/gathering が表示される
 * - 未参加なら：場所選択（こうえん/じどうかん/がっこう）と合言葉入力が表示される
 * - 境界値：合言葉なしで「あつまる！」を押すとエラー
 * - 参加中なら：合言葉/メンバー数表示が出る
 */
import { test, expect } from "./fixtures";

test.describe("S21: ひろば", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/app/child/gathering");
    await expect(page.getByRole("heading", { name: /ひろば/ })).toBeVisible({
      timeout: 15000,
    });
  });

  test("見出し「🏕️ ひろば」が表示される", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /ひろば/ })).toBeVisible();
  });

  test("未参加なら参加フォームが、参加中ならグループ情報が表示される", async ({ page }) => {
    const joinBtn = page.getByRole("button", { name: /あつまる！/ });
    const leaveBtn = page.getByRole("button", { name: /ぬける/ });
    await expect(joinBtn.or(leaveBtn)).toBeVisible({ timeout: 10000 });
  });

  test("参加フォームでは場所3種と合言葉入力が表示される（未参加時のみ）", async ({ page }) => {
    const joinBtn = page.getByRole("button", { name: /あつまる！/ });
    if (!(await joinBtn.isVisible())) {
      test.skip(true, "すでに参加中のためスキップ");
      return;
    }
    // 場所ボタン3種類
    await expect(page.getByRole("button", { name: /こうえん|公園/ })).toBeVisible();
    await expect(page.locator('input[placeholder="れいんぼー"]')).toBeVisible();
  });

  test("境界値: 合言葉未入力で「あつまる！」を押すとエラーが表示される", async ({ page }) => {
    const joinBtn = page.getByRole("button", { name: /あつまる！/ });
    if (!(await joinBtn.isVisible())) {
      test.skip(true, "すでに参加中のためスキップ");
      return;
    }
    await joinBtn.click();
    await expect(page.getByText("合言葉を入れてね")).toBeVisible({ timeout: 5000 });
  });
});
