/**
 * S6: 親クエスト承認フロー
 * 前提: as-parent-premium プロジェクト（storageState: parent.json）で実行
 *
 * - /app/parent/approve が表示される
 * - 承認待ちのクエストカードが表示される
 * - 承認ボタンで承認され、リストから消える（カード本体のタップでは承認されない。#190）
 * - 「まとめて承認」ボタンが動作する
 * - 差し戻しモーダルが開く
 * - 境界値: 理由未選択では「差し戻す」ボタンが無効
 *
 * 前提データ（REPORTED / SKIP_REPORTED クエスト）は helpers/testData.ts で毎回用意し、
 * UI では自分が作ったカード（title で絞る）だけを検証する（Issue #221）。
 * 承認センターの件数は他の spec が作ったデータで変わるため、完全一致では検証しない。
 */
import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";
import {
  openSessions,
  seedQuestInStatus,
  type SeededQuest,
  type Sessions,
} from "./helpers/testData";

const CARD = ".bg-quest-card.border.rounded-xl.p-5";

async function gotoApprove(page: Page) {
  await page.goto("/app/parent/approve");
  await expect(page.getByRole("heading", { name: /承認センター/ })).toBeVisible({
    timeout: 15000,
  });
}

test.describe("S6: 親クエスト承認", () => {
  test("承認センターページが表示される", async ({ page }) => {
    await gotoApprove(page);
    await expect(page.getByRole("heading", { name: /承認センター/ })).toBeVisible();
    // 件数テキストが表示される（0件 or N件）
    await expect(page.getByText(/件の報告が承認待ちです/)).toBeVisible();
  });

  // 共有の家族では他 spec が作った承認待ちが残るため、0 件の状態を確実には作れない。
  // 新しい家族を作る fixture（Issue #221 Q3）を用意する後続 Issue で対応する。
  test.fixme(
    "承認待ちがない場合は「承認待ちの報告はありません」と表示される",
    async ({ page }) => {
      await gotoApprove(page);
      await expect(page.locator(CARD)).toHaveCount(0);
      await expect(page.getByText("承認待ちの報告はありません")).toBeVisible();
    },
  );

  test.describe("承認待ち（REPORTED）クエストがある場合", () => {
    let sessions: Sessions;
    let quest: SeededQuest;

    test.beforeEach(async ({ page }) => {
      sessions = await openSessions();
      quest = await seedQuestInStatus(sessions, "REPORTED", { tag: "s6" });
      await gotoApprove(page);
    });

    test.afterEach(async () => {
      await sessions?.dispose();
    });

    test("承認待ちクエストカードが表示される", async ({ page }) => {
      await expect(page.locator(CARD).filter({ hasText: quest.title })).toBeVisible();
    });

    test("承認ボタンを押すと承認される", async ({ page }) => {
      const card = page.locator(CARD).filter({ hasText: quest.title });
      await expect(card).toBeVisible();
      await card.getByRole("button", { name: /^✓ 承認/ }).click();
      // 自分のカードが消えることを確認
      await expect(card).toHaveCount(0, { timeout: 10000 });
    });

    test("カード本体をタップしても承認されない（誤タップ防止）", async ({ page }) => {
      const card = page.locator(CARD).filter({ hasText: quest.title });
      await expect(card).toBeVisible();
      // タイトル行（ボタン以外）をタップしてもカードは残る
      await card.getByText(quest.title).click();
      await page.waitForTimeout(1000);
      await expect(card).toBeVisible();
    });

    test("承認待ちが複数ある場合、「まとめて承認」ボタンが表示される", async ({ page }) => {
      // 2件目を追加して画面を再取得する
      await seedQuestInStatus(sessions, "REPORTED", { tag: "s6b" });
      await page.reload();
      await expect(page.getByRole("heading", { name: /承認センター/ })).toBeVisible({
        timeout: 15000,
      });
      await expect(page.locator(CARD).filter({ hasText: quest.title })).toBeVisible();
      await expect(page.getByRole("button", { name: /まとめて承認/ })).toBeVisible();
    });

    test("差し戻しボタンで差し戻しモーダルが開く", async ({ page }) => {
      const card = page.locator(CARD).filter({ hasText: quest.title });
      await expect(card).toBeVisible();
      // 「差し戻し」ボタンをクリック（カードクリックとは別のボタン）
      await card.getByRole("button", { name: /差し戻し/ }).click();

      // 差し戻しモーダルが表示される
      await expect(page.getByText("差し戻し理由を選んでください")).toBeVisible();
      await expect(page.getByRole("button", { name: /差し戻す/ })).toBeVisible();
    });

    test("境界値: 差し戻しモーダルで理由未選択は「差し戻す」が無効", async ({ page }) => {
      const card = page.locator(CARD).filter({ hasText: quest.title });
      await expect(card).toBeVisible();
      await card.getByRole("button", { name: /差し戻し/ }).click();
      await expect(page.getByText("差し戻し理由を選んでください")).toBeVisible();

      // 理由を選択していないと「差し戻す」は disabled
      await expect(page.getByRole("button", { name: /差し戻す/ })).toBeDisabled();
    });

    test("差し戻しモーダルはキャンセルで閉じる", async ({ page }) => {
      const card = page.locator(CARD).filter({ hasText: quest.title });
      await expect(card).toBeVisible();
      await card.getByRole("button", { name: /差し戻し/ }).click();
      await expect(page.getByText("差し戻し理由を選んでください")).toBeVisible();

      await page.getByRole("button", { name: /キャンセル/ }).click();
      await expect(page.getByText("差し戻し理由を選んでください")).not.toBeVisible();
    });
  });

  test.describe("スキップ申請（SKIP_REPORTED）クエストがある場合", () => {
    let sessions: Sessions;
    let quest: SeededQuest;

    test.beforeEach(async ({ page }) => {
      sessions = await openSessions();
      quest = await seedQuestInStatus(sessions, "SKIP_REPORTED", { tag: "s6s" });
      await gotoApprove(page);
    });

    test.afterEach(async () => {
      await sessions?.dispose();
    });

    test("スキップ申請カードは赤系UIで表示される", async ({ page }) => {
      const skipCard = page.locator(".border-red-400\\/20").filter({ hasText: quest.title });
      await expect(skipCard).toBeVisible();
      await expect(skipCard.getByText(/スキップを承認/)).toBeVisible();
    });
  });
});
