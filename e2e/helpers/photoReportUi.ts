/**
 * 写真付き報告の UI 操作ヘルパー（Issue #223）。s27 / s28 で共有する。
 * セレクタは alt 属性・ボタン名で絞る（実装詳細のクラスには極力依存しない）。
 */
import path from "path";
import { expect, type Browser, type Locator, type Page } from "@playwright/test";
import { createBrowserContext } from "../credentials";

export const CHILD_AUTH = path.join(process.cwd(), "playwright/.auth/child-light.json");

export type UploadFile = { name: string; mimeType: string; buffer: Buffer };

/** JST の現在時刻（"HH:mm:ss"）。アサーションメッセージ用。 */
export function jstClockLabel(now = Date.now()): string {
  return new Date(now + 9 * 60 * 60 * 1000).toISOString().slice(11, 19);
}

/** JST 23:58〜24:00 は期限 "23:59" の判定と日付が実行時刻に依存する。 */
export function isInJstDeadlineDangerWindow(now = Date.now()): boolean {
  const j = new Date(now + 9 * 60 * 60 * 1000);
  return j.getUTCHours() === 23 && j.getUTCMinutes() >= 58;
}

/** 子の今日のクエスト一覧から自分のカードを開き、アクションシートを表示する。 */
export async function openQuestSheet(childPage: Page, title: string): Promise<void> {
  await childPage.goto("/app/child/quests");
  const card = childPage.locator(".bg-quest-card.border.cursor-pointer").filter({ hasText: title });
  await expect(card).toBeVisible({ timeout: 15000 });
  await card.click();
  await expect(childPage.getByRole("button", { name: /クエスト完了！/ })).toBeVisible({
    timeout: 5000,
  });
}

/** capture の無い（ギャラリー側）input[type=file] に直接ファイルを渡す。 */
export async function attachPhoto(childPage: Page, file: UploadFile): Promise<void> {
  await childPage.locator('input[type="file"]:not([capture])').setInputFiles(file);
}

export async function clickComplete(childPage: Page): Promise<void> {
  await childPage.getByRole("button", { name: /クエスト完了！/ }).click();
}

/** 子ブラウザコンテキストで報告までを行い、閉じる。file 省略時は写真なし。 */
export async function reportViaChildUi(
  browser: Browser,
  title: string,
  file?: UploadFile,
): Promise<void> {
  const { context, page } = await createBrowserContext(browser, CHILD_AUTH, { bypass: "route" });
  try {
    await openQuestSheet(page, title);
    if (file) {
      await attachPhoto(page, file);
      await expect(page.getByAltText("プレビュー")).toBeVisible();
    }
    await clickComplete(page);
    await expect(page.getByText("クエスト完了！").first()).toBeVisible({ timeout: 15000 });
  } finally {
    await context.close();
  }
}

/** 親の承認センターを開き、自分のタスクのカードを返す。 */
export async function gotoApproveCard(parentPage: Page, title: string): Promise<Locator> {
  await parentPage.goto("/app/parent/approve");
  await expect(parentPage.getByRole("heading", { name: /承認センター/ })).toBeVisible({
    timeout: 15000,
  });
  const card = parentPage
    .locator(".bg-quest-card.border.rounded-xl.p-5")
    .filter({ hasText: title });
  await expect(card).toBeVisible({ timeout: 10000 });
  return card;
}

/** img が実際に読み込めている（complete && naturalWidth > 0）ことを検証する。 */
export async function expectImageLoaded(img: Locator, message?: string): Promise<void> {
  await expect
    .poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0), {
      message: message ?? "画像が読み込めていません",
      timeout: 15000,
    })
    .toBe(true);
}

export async function naturalSize(img: Locator): Promise<{ w: number; h: number }> {
  return img.evaluate((el: HTMLImageElement) => ({ w: el.naturalWidth, h: el.naturalHeight }));
}
