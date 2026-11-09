/**
 * S27: 写真付き報告 → 親の表示 → XP（Issue #223）
 * 前提: as-parent-premium プロジェクト（親 storageState）。子の操作は child-light.json のコンテキストで行う。
 *
 * - XP は承認の前後の studyPt の差分で検証する（category は STUDY 固定）。
 * - 報告期限は各テストの冒頭（beforeEach）で明示的に null に設定し、afterEach で null に戻す（s13 の残り対策）。
 * - 期限ボーナスは s28 で扱う。
 * - skip / fixme は使わない。アプリのバグが見つかった場合は src を直さず test.fail() + 理由コメント。
 */
import type { Browser, Page } from "@playwright/test";
import { test, expect } from "./fixtures";
import { createBrowserContext, readCredentials } from "./credentials";
import {
  approveQuest,
  createTodayTask,
  getTodayQuestByTitle,
  openSessions,
  type Sessions,
} from "./helpers/testData";
import {
  ensureXpHeadroom,
  getChildPoints,
  getReportDeadline,
  makePngBuffer,
  postReportRaw,
  setReportDeadline,
} from "./helpers/photoXp";
import {
  CHILD_AUTH,
  attachPhoto,
  clickComplete,
  expectImageLoaded,
  gotoApproveCard,
  jstClockLabel,
  naturalSize,
  openQuestSheet,
  reportViaChildUi,
} from "./helpers/photoReportUi";

const PNG_64 = () => ({ name: "small.png", mimeType: "image/png", buffer: makePngBuffer(64, 64) });
const UPLOAD_ERROR = "写真のアップロードに失敗しました";

let s: Sessions;

test.beforeAll(async () => {
  s = await openSessions();
});
test.afterAll(async () => {
  await s?.dispose();
});
test.beforeEach(async () => {
  await setReportDeadline(s.parentReq, s.childId, null);
  await ensureXpHeadroom(s.parentReq, s.childReq, s.childId);
});
test.afterEach(async () => {
  await setReportDeadline(s.parentReq, s.childId, null);
  expect(await getReportDeadline(s.parentReq, s.childId)).toBeNull();
});

async function prepareQuest(photoBonus: boolean, tag: string) {
  const { title } = await createTodayTask(s.parentReq, {
    childId: s.childId,
    category: "STUDY",
    photoBonus,
    tag,
  });
  const quest = await getTodayQuestByTitle(s.childReq, title);
  return { title, questId: quest.id };
}

async function studyPt(): Promise<number> {
  return (await getChildPoints(s.parentReq, s.childId)).studyPt;
}

/** 写真付きで報告し、承認センターの img src（実在オブジェクトの URL）を返す。クエストは REPORTED のまま。 */
async function reportWithRealPhoto(browser: Browser, parentPage: Page, title: string): Promise<string> {
  await reportViaChildUi(browser, title, PNG_64());
  const card = await gotoApproveCard(parentPage, title);
  const src = await card.getByAltText("報告写真").getAttribute("src");
  expect(src, "報告写真の src").toBeTruthy();
  return src as string;
}

test.describe("S27: 写真付き報告と XP", () => {
  test("写真を選ぶとプレビューが出て +1pt の案内が消える", async ({ browser }) => {
    const { title } = await prepareQuest(true, "s27prev");
    const { context, page } = await createBrowserContext(browser, CHILD_AUTH, { bypass: "route" });
    try {
      await openQuestSheet(page, title);
      await expect(page.getByText("写真を添付すると +1pt")).toBeVisible();
      await attachPhoto(page, PNG_64());
      await expect(page.getByAltText("プレビュー")).toBeVisible();
      await expect(page.getByText("写真を添付すると +1pt")).not.toBeVisible();
    } finally {
      await context.close();
    }
  });

  test("写真付き報告 → 承認センター表示 → 拡大 → 承認で +2 → 完了一覧・履歴・子の一覧", async ({
    page,
    browser,
  }) => {
    const { title, questId } = await prepareQuest(true, "s27photo");
    const before = await studyPt();
    await reportViaChildUi(browser, title, PNG_64());

    const card = await gotoApproveCard(page, title);
    await test.step("承認センターで写真が読み込めている", async () => {
      await expectImageLoaded(card.getByAltText("報告写真"));
    });
    await test.step("写真タップで拡大モーダルが開き、承認されない", async () => {
      await card.getByAltText("報告写真").click();
      // 他の承認待ちカードにも写真があるので、モーダル（fixed inset-0）の中だけを見る
      await expectImageLoaded(page.locator(".fixed.inset-0").getByAltText("報告写真"));
      await expect(card).toBeVisible();
      expect((await getTodayQuestByTitle(s.childReq, title)).status).toBe("REPORTED");
    });
    await test.step("承認ボタンが +2pt", async () => {
      await expect(card.getByText("✓ 承認 (+2pt)")).toBeVisible();
    });
    await approveQuest(s.parentReq, questId, { action: "approve" });
    expect(await studyPt(), `写真付き(期限なし) JST=${jstClockLabel()}`).toBe(before + 2);

    await test.step("完了一覧に写真と +2pt", async () => {
      await page.goto("/app/parent/completed");
      const c = page.locator("div.bg-quest-card.rounded-xl").filter({ hasText: title });
      await expect(c.getByText("+2pt")).toBeVisible({ timeout: 15000 });
      await expectImageLoaded(c.getByAltText("報告写真"));
    });
    await test.step("履歴に写真と +2pt", async () => {
      await page.goto("/app/parent/history");
      const c = page.locator("div.bg-quest-card.rounded-xl").filter({ hasText: title });
      await expect(c.getByText("+2pt")).toBeVisible({ timeout: 15000 });
      await expectImageLoaded(c.getByAltText("報告写真"));
    });
    await test.step("子の一覧の XP 表示が +2", async () => {
      const { context, page: childPage } = await createBrowserContext(browser, CHILD_AUTH, { bypass: "route" });
      try {
        await childPage.goto("/app/child/quests");
        const c = childPage.locator(".bg-quest-card.border").filter({ hasText: title });
        await expect(c.getByText("+2XP")).toBeVisible({ timeout: 15000 });
      } finally {
        await context.close();
      }
    });
  });

  test("photoBonus ON でも写真なしなら +1、報告写真は出ない", async ({ page, browser }) => {
    const { title, questId } = await prepareQuest(true, "s27nophoto");
    const before = await studyPt();
    await reportViaChildUi(browser, title);
    const card = await gotoApproveCard(page, title);
    await expect(card.getByAltText("報告写真")).toHaveCount(0);
    await expect(card.getByText("✓ 承認 (+1pt)")).toBeVisible();
    await approveQuest(s.parentReq, questId, { action: "approve" });
    expect(await studyPt(), `JST=${jstClockLabel()}`).toBe(before + 1);
  });

  test("photoBonus OFF のタスクには添付 UI が出ず、承認で +1", async ({ browser }) => {
    const { title, questId } = await prepareQuest(false, "s27off");
    const before = await studyPt();
    const { context, page } = await createBrowserContext(browser, CHILD_AUTH, { bypass: "route" });
    try {
      await openQuestSheet(page, title);
      await expect(page.getByText("カメラで撮る")).toHaveCount(0);
      await expect(page.getByText("ギャラリーから")).toHaveCount(0);
      await clickComplete(page);
      await expect(page.getByText("クエスト完了！").first()).toBeVisible({ timeout: 15000 });
    } finally {
      await context.close();
    }
    await approveQuest(s.parentReq, questId, { action: "approve" });
    expect(await studyPt(), `JST=${jstClockLabel()}`).toBe(before + 1);
  });

  test("photoBonus OFF に正しい photoUrl を付けて API 報告しても +1", async ({ page, browser }) => {
    const first = await prepareQuest(true, "s27src");
    const realUrl = await reportWithRealPhoto(browser, page, first.title);
    await approveQuest(s.parentReq, first.questId, { action: "approve" });

    const { questId } = await prepareQuest(false, "s27offurl");
    const before = await studyPt();
    const res = await postReportRaw(s.childReq, questId, { photoUrl: realUrl });
    expect(res.status, res.body).toBe(200);
    await approveQuest(s.parentReq, questId, { action: "approve" });
    expect(await studyPt(), `JST=${jstClockLabel()}`).toBe(before + 1);
  });
});

test.describe("S27: 異常系・境界値（ファイル）", () => {
  const TXT = { name: "a.txt", mimeType: "text/plain", buffer: Buffer.from("not an image") };

  test("画像でないファイルはアップロード失敗となり PENDING のまま、選び直すと報告できる", async ({
    browser,
  }) => {
    const { title } = await prepareQuest(true, "s27txt");
    const { context, page } = await createBrowserContext(browser, CHILD_AUTH, { bypass: "route" });
    let reportCalls = 0;
    page.on("request", (r) => {
      if (/\/api\/quests\/[^/]+\/report$/.test(new URL(r.url()).pathname)) reportCalls++;
    });
    try {
      await openQuestSheet(page, title);
      await attachPhoto(page, TXT);
      await clickComplete(page);
      await expect(page.getByText(UPLOAD_ERROR)).toBeVisible({ timeout: 15000 });
      await expect(page.getByRole("button", { name: /クエスト完了！/ })).toBeVisible();
      expect(reportCalls, "報告 API は呼ばれない").toBe(0);
      expect((await getTodayQuestByTitle(s.childReq, title)).status).toBe("PENDING");

      // 選び直すとエラーが消え、報告できる
      await attachPhoto(page, PNG_64());
      await expect(page.getByText(UPLOAD_ERROR)).not.toBeVisible();
      await clickComplete(page);
      await expect(page.getByText("クエスト完了！").first()).toBeVisible({ timeout: 15000 });
      await expect
        .poll(async () => (await getTodayQuestByTitle(s.childReq, title)).status)
        .toBe("REPORTED");
    } finally {
      await context.close();
    }
  });

  test("Storage が 500 を返してもエラー表示になり PENDING のまま", async ({ browser }) => {
    const { title } = await prepareQuest(true, "s27s500");
    const { context, page } = await createBrowserContext(browser, CHILD_AUTH, { bypass: "route" });
    try {
      await page.route("**/storage/v1/object/quest-photos/**", (route) =>
        route.fulfill({ status: 500, contentType: "application/json", body: '{"message":"boom"}' }),
      );
      await openQuestSheet(page, title);
      await attachPhoto(page, PNG_64());
      await clickComplete(page);
      await expect(page.getByText(UPLOAD_ERROR)).toBeVisible({ timeout: 15000 });
      expect((await getTodayQuestByTitle(s.childReq, title)).status).toBe("PENDING");
    } finally {
      await context.close();
    }
  });

  // 縮小の境界: 960x960 はそのまま、961x961 と 2000x1500 は 960 以下
  for (const c of [
    { w: 2000, h: 1500, exact: false },
    { w: 961, h: 961, exact: false },
    { w: 960, h: 960, exact: true },
  ]) {
    test(`${c.w}x${c.h} の画像は親の画面で 960 以下${c.exact ? "（そのまま 960x960）" : ""}で表示される`, async ({
      page,
      browser,
    }) => {
      const { title } = await prepareQuest(true, `s27sz${c.w}`);
      await reportViaChildUi(browser, title, {
        name: "big.png",
        mimeType: "image/png",
        buffer: makePngBuffer(c.w, c.h),
      });
      const card = await gotoApproveCard(page, title);
      const img = card.getByAltText("報告写真");
      await expectImageLoaded(img);
      const { w, h } = await naturalSize(img);
      expect(w, `width (${c.w}x${c.h})`).toBeLessThanOrEqual(960);
      expect(h, `height (${c.w}x${c.h})`).toBeLessThanOrEqual(960);
      if (c.exact) expect({ w, h }).toEqual({ w: 960, h: 960 });
    });
  }

  test("報告 API は外部 URL の photoUrl を 400 にし、PENDING のまま", async () => {
    const { title, questId } = await prepareQuest(true, "s27ext");
    const res = await postReportRaw(s.childReq, questId, {
      photoUrl: "https://evil.example.com/a.jpg",
    });
    expect(res.status, res.body).toBe(400);
    expect((await getTodayQuestByTitle(s.childReq, title)).status).toBe("PENDING");
  });

  test("報告 API は他の子のフォルダの photoUrl を 400 にし、PENDING のまま", async ({
    page,
    browser,
  }) => {
    const first = await prepareQuest(true, "s27oth1");
    const realUrl = await reportWithRealPhoto(browser, page, first.title);
    await approveQuest(s.parentReq, first.questId, { action: "approve" });

    // QA_child の実 URL のフォルダ部分を QA_child2 の ID に差し替える
    const other = readCredentials().childIdLight2;
    expect(other, "QA_child2 の ID（auth.setup が作成）").toBeTruthy();
    const otherUrl = realUrl.replace(`/quest-photos/${s.childId}/`, `/quest-photos/${other}/`);
    expect(otherUrl).not.toBe(realUrl);

    const { title, questId } = await prepareQuest(true, "s27oth2");
    const res = await postReportRaw(s.childReq, questId, { photoUrl: otherUrl });
    expect(res.status, res.body).toBe(400);
    expect((await getTodayQuestByTitle(s.childReq, title)).status).toBe("PENDING");
  });
});
