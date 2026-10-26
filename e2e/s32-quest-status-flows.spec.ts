/**
 * S32: クエストのステータス遷移フロー（子と親をまたぐ UI の通しフロー）（Issue #222）
 * 前提: as-parent-premium プロジェクトで実行。共有の QA アカウントは使わず、使い捨ての家族（#240）の親・子で操作する
 *   （共有の QA_child の XP を動かすと s11 の育成画面などが壊れるため）。
 *
 * XP・ストリークは同じ spec の前のテストの分が残るため「前後の差分」で検証する。
 * - 承認のたびに直前で ensureXpHeadroom を呼び、進化（pt リセット）が起きない状態にしておく。
 *   承認後に evolutionStage が変わっていたら fail（「進化したら検証しない」という分岐は作らない）。
 * - 期限ボーナスなし（reportDeadlineTime=null）・写真なし・宣言なしの前提で XP は 1。
 *   承認画面が「(+1pt)」でなければ、前提が崩れたとわかるメッセージで fail する。
 * - 画面操作は waitForResponse で API が 2xx を返したことも確認する（#190 で誤って緑にならないように）。
 * - ストリークの「今日」はサーバ応答（タスクの targetDate）と比べる。クライアントで日付を計算しない。
 */
import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";
import { REJECTION_REASONS } from "../src/lib/categories";
import {
  approveQuest,
  createTodayTask,
  getTodayQuestByTitle,
  reportQuest,
  seedQuestInStatus,
  type Sessions,
} from "./helpers/testData";
import { ensureXpHeadroom, setReportDeadline } from "./helpers/photoXp";
import { gotoApproveCard } from "./helpers/photoReportUi";
import { readQuestStatus } from "./helpers/authzAssert";
import { getMonsterSnapshot } from "./helpers/monsterSnapshot";
import type { DisposableFamily } from "./helpers/disposableFamily";
import {
  PREMISE_MESSAGE,
  approveAndExpectDelta,
  approveViaParentUi,
  cardWrapper,
  childCard,
  childRejectionReason,
  childStatus,
  clickAndExpect2xx,
  drainPending,
  expectApprovedDelta,
  expectPendingUnchanged,
  expectPtUnchanged,
  gotoChildQuests,
  newParentPage,
  openFamilySessions,
  rejectViaParentUi,
  reportViaChildUi,
  skipViaChildUi,
  withChildPage,
} from "./helpers/questFlow";

// seedQuestInStatus / createTodayTask の既定カテゴリは LIFE
const REASON = REJECTION_REASONS.LIFE[0];
const SEED_REJECTION_REASON = "もう一度やってみよう"; // seedQuestInStatus("REJECTED") が付ける固定の理由

let s: Sessions;
let family: DisposableFamily;
let page: Page;

test.describe.configure({ timeout: 180_000 });

test.beforeAll(async ({ browser }) => {
  test.setTimeout(120_000);
  ({ s, family } = await openFamilySessions(browser));
});
test.afterAll(async () => {
  await s?.dispose();
});
test.beforeEach(async () => {
  page = await newParentPage(family);
  await setReportDeadline(s.parentReq, s.childId, null);
  await ensureXpHeadroom(s.parentReq, s.childReq, s.childId);
});
test.afterEach(async () => {
  await page?.close();
});

// ---------- A. UI の通しフロー ----------

test.describe("S32-A: UI の通しフロー", () => {
  test("差し戻し → 理由表示 → 再報告 → 承認（T4 → T5 → T3）", async () => {
    const { title, questId } = await seedQuestInStatus(s, "REPORTED", { tag: "s32a1" });
    const beforeReject = await getMonsterSnapshot(s.childReq);

    await rejectViaParentUi(page, title, questId, REASON);
    expectPtUnchanged(beforeReject, await getMonsterSnapshot(s.childReq), "差し戻しの前後");
    expect(await childStatus(s, title)).toBe("REJECTED");

    await withChildPage(family.child.context, async (childPage) => {
    await gotoChildQuests(childPage);
    const card = childCard(childPage, title);
    await expect(card).toBeVisible({ timeout: 15000 });
    const wrapper = cardWrapper(card);
    await expect(wrapper.getByText("差し戻し理由")).toBeVisible();
    await expect(wrapper.getByText(REASON, { exact: true })).toBeVisible();

    await reportViaChildUi(childPage, title, questId);
    await expect(wrapper.getByText("差し戻し理由")).toHaveCount(0);
    });
    expect(await childStatus(s, title)).toBe("REPORTED");

    await approveViaParentUi(s, page, title, questId, "再報告後の承認");
    expect(await childStatus(s, title)).toBe("APPROVED");
  });

  test("差し戻し（「その他」＋前後に空白のある自由入力）→ 子の画面に trim されたコメントが出る", async () => {
    const { title, questId } = await seedQuestInStatus(s, "REPORTED", { tag: "s32a2" });
    const comment = `E2E理由${Date.now()}`;

    await rejectViaParentUi(page, title, questId, "その他", `  ${comment}  `);
    // 保存された理由は trim 済み（画面の空白は正規化されるため API でも確認する）
    expect(await childRejectionReason(s, title)).toBe(comment);

    await withChildPage(family.child.context, async (childPage) => {
    await gotoChildQuests(childPage);
    const card = childCard(childPage, title);
    await expect(card).toBeVisible({ timeout: 15000 });
    await expect(cardWrapper(card).getByText(comment, { exact: true })).toBeVisible();
    });
  });

  test("差し戻し → スキップ申請（T4 → T6）: 理由の表示が消え、親にスキップ申請として出る", async () => {
    const { title, questId } = await seedQuestInStatus(s, "REJECTED", { tag: "s32a3" });
    expect(await childRejectionReason(s, title)).toBe(SEED_REJECTION_REASON);

    await withChildPage(family.child.context, async (childPage) => {
    await gotoChildQuests(childPage);
    const card = childCard(childPage, title);
    await expect(card).toBeVisible({ timeout: 15000 });
    await expect(cardWrapper(card).getByText(SEED_REJECTION_REASON, { exact: true })).toBeVisible();

    await skipViaChildUi(childPage, title, questId, "体調不良のため");

    await gotoChildQuests(childPage); // 再取得
    const after = childCard(childPage, title);
    await expect(after.getByText(/申請中/)).toBeVisible({ timeout: 10000 });
    await expect(cardWrapper(after).getByText("差し戻し理由")).toHaveCount(0);
    });
    expect(await childRejectionReason(s, title)).toBeNull();
    expect(await readQuestStatus(s.parentReq, s.childId, title)).toBe("SKIP_REPORTED");

    const approveCard = await gotoApproveCard(page, title);
    await expect(approveCard.getByText(/スキップ申請/)).toBeVisible();
    await expect(approveCard, "スキップ申請は赤系のカード").toHaveClass(/border-red-400/);
  });

  test("スキップ却下で PENDING に戻る（T8）: 報告とスキップの両方が選べて XP は変わらない", async () => {
    const { title, questId } = await seedQuestInStatus(s, "SKIP_REPORTED", { tag: "s32a4" });
    const before = await getMonsterSnapshot(s.childReq);

    await rejectViaParentUi(page, title, questId, REASON);
    expect(await childStatus(s, title)).toBe("PENDING");
    const after = await getMonsterSnapshot(s.childReq);
    expectPtUnchanged(before, after, "スキップ却下の前後");
    expectPendingUnchanged(before, after, "スキップ却下の前後");

    await withChildPage(family.child.context, async (childPage) => {
    await gotoChildQuests(childPage);
    const card = childCard(childPage, title);
    await expect(card).toBeVisible({ timeout: 15000 });
    await expect(cardWrapper(card).getByText("差し戻し理由")).toHaveCount(0);
    await card.click();
    await expect(childPage.getByRole("button", { name: /クエスト完了！/ })).toBeVisible({ timeout: 5000 });
    await expect(childPage.getByText(/今日はスキップする/)).toBeVisible();
    });
  });

  test("スキップ却下のあと再報告して承認できる（T8 → T1 → T3）", async () => {
    const { title, questId } = await seedQuestInStatus(s, "SKIP_REPORTED", { tag: "s32a5" });
    await approveQuest(s.parentReq, questId, { action: "reject" });
    expect(await childStatus(s, title)).toBe("PENDING");

    await withChildPage(family.child.context, async (childPage) => {
    await gotoChildQuests(childPage);
    await expect(childCard(childPage, title)).toBeVisible({ timeout: 15000 });
    await reportViaChildUi(childPage, title, questId);
    });
    expect(await childStatus(s, title)).toBe("REPORTED");

    await approveViaParentUi(s, page, title, questId, "スキップ却下後の承認");
    expect(await childStatus(s, title)).toBe("APPROVED");
  });

  test("まとめて承認: 報告2件とスキップ申請1件が処理され、XP は報告2件分だけ増える", async () => {
    // 「まとめて承認」はその時点の承認待ち全件を処理するため、前のテストの残りを先に片付けて XP を確定的にする
    await drainPending(s);
    await ensureXpHeadroom(s.parentReq, s.childReq, s.childId);

    const r1 = await seedQuestInStatus(s, "REPORTED", { tag: "s32a6r1" });
    const r2 = await seedQuestInStatus(s, "REPORTED", { tag: "s32a6r2" });
    const sk = await seedQuestInStatus(s, "SKIP_REPORTED", { tag: "s32a6sk" });
    const before = await getMonsterSnapshot(s.childReq);

    const firstCard = await gotoApproveCard(page, r1.title);
    await expect(firstCard.getByText("✓ 承認 (+1pt)"), PREMISE_MESSAGE).toBeVisible();
    await clickAndExpect2xx(
      page,
      page.getByRole("button", { name: /まとめて承認/ }),
      /^\/api\/approve\/bulk$/,
    );
    for (const t of [r1.title, r2.title, sk.title]) {
      await expect(
        page.locator(".bg-quest-card.border.rounded-xl.cursor-pointer").filter({ hasText: t }),
        `「${t}」が承認センターに残っています`,
      ).toHaveCount(0, { timeout: 10000 });
    }

    expect(await readQuestStatus(s.parentReq, s.childId, r1.title)).toBe("APPROVED");
    expect(await readQuestStatus(s.parentReq, s.childId, r2.title)).toBe("APPROVED");
    expect(await readQuestStatus(s.parentReq, s.childId, sk.title)).toBe("SKIPPED");
    expectApprovedDelta(before, await getMonsterSnapshot(s.childReq), 2, "まとめて承認（報告2件）");
  });

  test("承認後の子の画面: 完了表示になり、タップしても報告シートが開かない", async () => {
    const { title } = await seedQuestInStatus(s, "APPROVED", { tag: "s32a7" });

    await withChildPage(family.child.context, async (childPage) => {
    await gotoChildQuests(childPage);
    const card = childCard(childPage, title);
    await expect(card).toBeVisible({ timeout: 15000 });
    await expect(card.getByText("承認済み")).toBeVisible();
    await expect(card, "承認済みのカードはタップ可能なスタイルではない").not.toHaveClass(/cursor-pointer/);

    await card.click();
    await expect(childPage.getByRole("button", { name: /クエスト完了！/ })).toHaveCount(0);
    await expect(childPage.getByText(/今日はスキップする/)).toHaveCount(0);
    });
  });
});

// ---------- C. XP 付与のタイミング（API で遷移させ、スナップショットの差分で検証） ----------

test.describe("S32-C: XP 付与のタイミング", () => {
  test("報告・差し戻し・再報告・承認で pt と pendingPt が規約どおりに動く", async () => {
    const { questId } = await seedQuestInStatus(s, "PENDING", { tag: "s32c1" });

    const s0 = await getMonsterSnapshot(s.childReq);
    await reportQuest(s.childReq, questId);
    const s1 = await getMonsterSnapshot(s.childReq);
    expectPtUnchanged(s0, s1, "報告（XP はまだ付かない）");
    expect(s1.pendingLifePt, "報告で pendingLifePt が +1").toBe(s0.pendingLifePt + 1);
    expect([s1.pendingStudyPt, s1.pendingStaminaPt], "他カテゴリの pending は不変").toEqual([
      s0.pendingStudyPt,
      s0.pendingStaminaPt,
    ]);

    await approveQuest(s.parentReq, questId, { action: "reject" });
    const s2 = await getMonsterSnapshot(s.childReq);
    expectPtUnchanged(s1, s2, "差し戻し（XP は付かない・回収もされない）");
    expectPendingUnchanged(s0, s2, "差し戻しで pending が報告前に戻る");

    await reportQuest(s.childReq, questId);
    await ensureXpHeadroom(s.parentReq, s.childReq, s.childId);
    const s3 = await getMonsterSnapshot(s.childReq);
    expect(s3.pendingLifePt, "再報告で pendingLifePt が +1").toBe(s0.pendingLifePt + 1);

    await approveQuest(s.parentReq, questId, { action: "approve" });
    const s4 = await getMonsterSnapshot(s.childReq);
    expectApprovedDelta(s3, s4, 1, "承認");
    expect(s4.pendingLifePt, "承認で pendingLifePt が 1 減る").toBe(s3.pendingLifePt - 1);
    expect([s4.pendingStudyPt, s4.pendingStaminaPt]).toEqual([s3.pendingStudyPt, s3.pendingStaminaPt]);
  });

  test("スキップ承認（SKIP_REPORTED → SKIPPED）では pt も pendingPt も変わらない", async () => {
    const { questId } = await seedQuestInStatus(s, "SKIP_REPORTED", { tag: "s32c2" });
    const before = await getMonsterSnapshot(s.childReq);
    await approveQuest(s.parentReq, questId, { action: "approve" });
    const after = await getMonsterSnapshot(s.childReq);
    expectPtUnchanged(before, after, "スキップ承認");
    expectPendingUnchanged(before, after, "スキップ承認");
  });

  test("スキップ却下（SKIP_REPORTED → PENDING）では pt も pendingPt も変わらない", async () => {
    const { questId, title } = await seedQuestInStatus(s, "SKIP_REPORTED", { tag: "s32c3" });
    const before = await getMonsterSnapshot(s.childReq);
    await approveQuest(s.parentReq, questId, { action: "reject" });
    const after = await getMonsterSnapshot(s.childReq);
    expect(await childStatus(s, title)).toBe("PENDING");
    expectPtUnchanged(before, after, "スキップ却下");
    expectPendingUnchanged(before, after, "スキップ却下");
  });

  test("ストリーク: 承認後に lastAchievedDate が今日、currentStreak >= 1。同じ日の2件目で変わらない", async () => {
    const make = async (tag: string) => {
      const t = await createTodayTask(s.parentReq, { childId: s.childId, category: "LIFE", tag });
      if (!t.targetDate) throw new Error(`[s32] タスク「${t.title}」の targetDate がサーバ応答にありません`);
      const q = await getTodayQuestByTitle(s.childReq, t.title);
      await reportQuest(s.childReq, q.id);
      return { questId: q.id, today: t.targetDate.slice(0, 10) };
    };

    const first = await make("s32c4a");
    const { after: afterFirst } = await approveAndExpectDelta(s, first.questId, 1, "1件目の承認");
    expect(afterFirst.lastAchievedDate, "lastAchievedDate はサーバの今日（JST）").toBe(first.today);
    expect(afterFirst.currentStreak, "currentStreak >= 1").toBeGreaterThanOrEqual(1);

    const second = await make("s32c4b");
    const { after: afterSecond } = await approveAndExpectDelta(s, second.questId, 1, "2件目の承認");
    expect(afterSecond.lastAchievedDate).toBe(afterFirst.lastAchievedDate);
    expect(afterSecond.currentStreak, "同じ日の2件目でストリークは変わらない").toBe(afterFirst.currentStreak);
  });
});
