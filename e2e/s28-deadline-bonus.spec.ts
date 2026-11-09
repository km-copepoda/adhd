/**
 * S28: 期限ボーナスと XP の範囲表示（Issue #223）
 * 前提: as-parent-premium プロジェクト。
 *
 * 時刻に依存させないため、期限 "00:00"（当日は必ず期限後）と "23:59"（JST 23:58 前なら必ず期限内）を使う。
 * skip は「JST 23:58〜24:00」の beforeEach の 1 箇所だけ（期限判定と日付が実行時刻に依存するため）。
 * 各テストは冒頭で報告期限を明示的に設定し、afterEach で null に戻す。
 */
import { test, expect } from "./fixtures";
import { createBrowserContext } from "./credentials";
import {
  approveQuest,
  createTodayTask,
  getTodayQuestByTitle,
  openSessions,
  reportQuest,
  type Sessions,
} from "./helpers/testData";
import {
  ensureXpHeadroom,
  getChildPoints,
  getReportDeadline,
  makePngBuffer,
  setReportDeadline,
} from "./helpers/photoXp";
import {
  CHILD_AUTH,
  gotoApproveCard,
  isInJstDeadlineDangerWindow,
  jstClockLabel,
  openQuestSheet,
  reportViaChildUi,
} from "./helpers/photoReportUi";

const PNG_64 = () => ({ name: "small.png", mimeType: "image/png", buffer: makePngBuffer(64, 64) });

let s: Sessions;

test.beforeAll(async () => {
  s = await openSessions();
});
test.afterAll(async () => {
  await s?.dispose();
});
test.beforeEach(async () => {
  test.skip(
    isInJstDeadlineDangerWindow(),
    "JST 23:58-24:00 は期限ボーナスの判定と日付が実行時刻に依存するため",
  );
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

const studyPt = async () => (await getChildPoints(s.parentReq, s.childId)).studyPt;

test.describe("S28: 期限ボーナス", () => {
  const cases = [
    { deadline: "23:59", photo: false, xp: 2 },
    { deadline: "23:59", photo: true, xp: 3 },
    { deadline: "00:00", photo: false, xp: 1 },
    { deadline: "00:00", photo: true, xp: 2 },
  ];
  for (const c of cases) {
    test(`期限 ${c.deadline} / 写真${c.photo ? "あり" : "なし"} → +${c.xp}`, async ({ page, browser }) => {
      await setReportDeadline(s.parentReq, s.childId, c.deadline);
      const { title, questId } = await prepareQuest(true, "s28dl");
      const before = await studyPt();
      await reportViaChildUi(browser, title, c.photo ? PNG_64() : undefined);
      const reportedAt = jstClockLabel();

      const card = await gotoApproveCard(page, title);
      await expect(card.getByText(`✓ 承認 (+${c.xp}pt)`)).toBeVisible();
      await approveQuest(s.parentReq, questId, { action: "approve" });
      expect(await studyPt(), `期限=${c.deadline} 写真=${c.photo} 報告 JST=${reportedAt}`).toBe(
        before + c.xp,
      );
    });
  }
});

test.describe("S28: XP の範囲表示", () => {
  const cases: { deadline: string | null; photoBonus: boolean; label: string }[] = [
    { deadline: "23:59", photoBonus: true, label: "+1〜3pt" },
    { deadline: null, photoBonus: true, label: "+1〜2pt" },
    { deadline: null, photoBonus: false, label: "+1pt" },
  ];
  for (const c of cases) {
    test(`期限 ${c.deadline ?? "なし"} / 写真ボーナス${c.photoBonus ? "あり" : "なし"} → ${c.label}`, async ({
      page,
      browser,
    }) => {
      await setReportDeadline(s.parentReq, s.childId, c.deadline);
      const { title, questId } = await prepareQuest(c.photoBonus, "s28rng");

      const { context, page: childPage } = await createBrowserContext(browser, CHILD_AUTH, { bypass: "route" });
      try {
        await openQuestSheet(childPage, title);
        await expect(childPage.getByText(c.label, { exact: true })).toBeVisible();
      } finally {
        await context.close();
      }

      await reportQuest(s.childReq, questId);
      const card = await gotoApproveCard(page, title);
      await expect(card.getByText(`学力 · ${c.label}`)).toBeVisible();
    });
  }
});

test.describe("S28: 差し戻し後の再報告", () => {
  test("期限内で報告 → 差し戻し → 期限を 00:00 に変えて再報告 → 期限ボーナスが残る(+2)", async () => {
    await setReportDeadline(s.parentReq, s.childId, "23:59");
    const { questId } = await prepareQuest(false, "s28rj1");
    const before = await studyPt();
    await reportQuest(s.childReq, questId);
    await approveQuest(s.parentReq, questId, { action: "reject" });
    await setReportDeadline(s.parentReq, s.childId, "00:00");
    await reportQuest(s.childReq, questId);
    await approveQuest(s.parentReq, questId, { action: "approve" });
    expect(await studyPt(), `JST=${jstClockLabel()}`).toBe(before + 2);
  });

  test("期限後で報告 → 差し戻し → 期限を 23:59 に変えて再報告 → 期限ボーナスは付かない(+1)", async () => {
    await setReportDeadline(s.parentReq, s.childId, "00:00");
    const { questId } = await prepareQuest(false, "s28rj2");
    const before = await studyPt();
    await reportQuest(s.childReq, questId);
    await approveQuest(s.parentReq, questId, { action: "reject" });
    await setReportDeadline(s.parentReq, s.childId, "23:59");
    await reportQuest(s.childReq, questId);
    await approveQuest(s.parentReq, questId, { action: "approve" });
    expect(await studyPt(), `JST=${jstClockLabel()}`).toBe(before + 1);
  });

  test("写真付き報告 → 差し戻し → 写真なしで再報告すると初回の写真は残らず +1", async ({
    page,
    browser,
  }) => {
    await setReportDeadline(s.parentReq, s.childId, null);
    const { title, questId } = await prepareQuest(true, "s28rj3");
    const before = await studyPt();
    await reportViaChildUi(browser, title, PNG_64());
    await approveQuest(s.parentReq, questId, { action: "reject" });
    await reportQuest(s.childReq, questId); // photoUrl なしの再報告（現仕様: photoUrl を null で上書き）

    const card = await gotoApproveCard(page, title);
    await expect(card.getByAltText("報告写真")).toHaveCount(0);
    await expect(card.getByText("✓ 承認 (+1pt)")).toBeVisible();
    await approveQuest(s.parentReq, questId, { action: "approve" });
    expect(await studyPt(), `JST=${jstClockLabel()}`).toBe(before + 1);
  });
});
