/**
 * クエスト状態遷移 E2E（s32 / s33）の共通ヘルパー（Issue #222）。
 * - 差分アサーション: スナップショット（monsterSnapshot.ts）の前後比較
 * - UI 操作: 子・親の画面操作。waitForResponse で API が 2xx を返したことも確認する（#190 で誤って緑にならないように）
 * - 共有の QA_child の XP を動かすと他の spec（s11 の育成画面など）が壊れるため、使い捨ての家族（#240）で実行する。
 *   同じ spec 内では前のテストの XP が残るので「前後の差分」で検証する。LIFE カテゴリ（seedQuestInStatus の既定）前提。
 */
import { expect } from "@playwright/test";
import type { Browser, BrowserContext, Locator, Page } from "@playwright/test";
import { setupBypassRoute } from "../credentials";
import { approveQuest, callApi, getTodayQuestByTitle, type QuestStatus, type Sessions } from "./testData";
import { gotoApproveCard } from "./photoReportUi";
import { createDisposableFamily, type DisposableFamily } from "./disposableFamily";
import { ensureXpHeadroom } from "./photoXp";
import { getMonsterSnapshot, type MonsterSnapshot } from "./monsterSnapshot";

export const PREMISE_MESSAGE =
  "前提が崩れています: 承認ボタンが「(+1pt)」ではありません（子に報告期限が設定されている、写真・宣言ボーナスが付いているなど）";

// ---------- 差分アサーション ----------

/** evolutionStage と3カテゴリの pt が同じ（XP が付かない／回収されない） */
export function expectPtUnchanged(before: MonsterSnapshot, after: MonsterSnapshot, label: string) {
  expect(after.evolutionStage, `${label}: evolutionStage`).toBe(before.evolutionStage);
  expect(
    [after.studyPt, after.staminaPt, after.lifePt],
    `${label}: study/stamina/life pt`,
  ).toEqual([before.studyPt, before.staminaPt, before.lifePt]);
}

/** pendingXxxPt が同じ */
export function expectPendingUnchanged(before: MonsterSnapshot, after: MonsterSnapshot, label: string) {
  expect(
    [after.pendingStudyPt, after.pendingStaminaPt, after.pendingLifePt],
    `${label}: pending study/stamina/life pt`,
  ).toEqual([before.pendingStudyPt, before.pendingStaminaPt, before.pendingLifePt]);
}

/** 承認で LIFE の pt がちょうど +xp、他の2カテゴリと evolutionStage は不変（進化したら fail） */
export function expectApprovedDelta(before: MonsterSnapshot, after: MonsterSnapshot, xp: number, label: string) {
  expect(
    after.evolutionStage,
    `${label}: 承認で進化しました（ensureXpHeadroom が効いていません）`,
  ).toBe(before.evolutionStage);
  expect(
    [after.studyPt, after.staminaPt, after.lifePt],
    `${label}: 承認後の pt（LIFE が +${xp}）`,
  ).toEqual([before.studyPt, before.staminaPt, before.lifePt + xp]);
}

// ---------- 画面操作 ----------

/** クリックして、指定パスの POST が 2xx で返ることを確認する */
export async function clickAndExpect2xx(page: Page, trigger: Locator, pathPattern: RegExp) {
  const [res] = await Promise.all([
    page.waitForResponse(
      (r) => r.request().method() === "POST" && pathPattern.test(new URL(r.url()).pathname),
    ),
    trigger.click(),
  ]);
  const status = res.status();
  expect(status >= 200 && status < 300, `${res.url()} が 2xx ではありません（status=${status}）`).toBe(true);
}

/** 進化・チェックインなどのカットインが出ていれば閉じる */
export async function dismissOverlays(p: Page) {
  const tap = p.getByText("タップして閉じる").first();
  try {
    await tap.waitFor({ state: "visible", timeout: 1500 });
    await tap.click();
  } catch {
    // カットインが出ていないのは正常
  }
}

export async function gotoChildQuests(p: Page) {
  await p.goto("/app/child/quests");
  await expect(p.getByRole("heading", { name: /今日のクエスト/ })).toBeVisible({ timeout: 15000 });
  await dismissOverlays(p);
}

export function childCard(p: Page, title: string): Locator {
  return p.locator(".bg-quest-card.border.rounded-xl.overflow-hidden").filter({ hasText: title });
}

/** カードを包む要素（差し戻し理由のバナーはカードの外側の兄弟要素にある） */
export function cardWrapper(card: Locator): Locator {
  return card.locator("xpath=..");
}

/** 親の UI: 承認センターで自分のカードを差し戻す（POST が 2xx でカードが消える） */
export async function rejectViaParentUi(
  page: Page,
  title: string,
  questId: string,
  reason: string,
  otherComment?: string,
) {
  const card = await gotoApproveCard(page, title);
  await card.getByRole("button", { name: "差し戻し" }).click();
  await page.getByRole("button", { name: reason, exact: true }).click();
  if (otherComment !== undefined) {
    await page.getByPlaceholder("理由を入力してください（必須）").fill(otherComment);
  }
  await clickAndExpect2xx(
    page,
    page.getByRole("button", { name: "差し戻す" }),
    new RegExp(`^/api/approve/${questId}$`),
  );
  await expect(card).toHaveCount(0, { timeout: 10000 });
}

/** 子の UI: カードを開いて「クエスト完了！」で報告する（POST が 2xx で「確認中」になる） */
export async function reportViaChildUi(p: Page, title: string, questId: string) {
  const card = childCard(p, title);
  await card.click();
  await clickAndExpect2xx(
    p,
    p.getByRole("button", { name: /クエスト完了！/ }),
    new RegExp(`^/api/quests/${questId}/report$`),
  );
  await expect(card.getByText(/確認中/)).toBeVisible({ timeout: 10000 });
}

/** 子の UI: カードを開いてスキップを申請する（POST が 2xx） */
export async function skipViaChildUi(p: Page, title: string, questId: string, reason: string) {
  await childCard(p, title).click();
  await p.getByText(/今日はスキップする/).click();
  await p.fill('input[placeholder="理由を入力（必須）"]', reason);
  await clickAndExpect2xx(
    p,
    p.getByRole("button", { name: /スキップを申請する/ }),
    new RegExp(`^/api/quests/${questId}/skip$`),
  );
}

// ---------- 子・親のセッションを使う操作（Sessions を明示的に受け取る） ----------

/** 承認直前に進化の余裕を作り、承認前後のスナップショットで +xp を検証する（API 承認） */
export async function approveAndExpectDelta(s: Sessions, questId: string, xp: number, label: string) {
  await ensureXpHeadroom(s.parentReq, s.childReq, s.childId);
  const before = await getMonsterSnapshot(s.childReq);
  await approveQuest(s.parentReq, questId, { action: "approve" });
  const after = await getMonsterSnapshot(s.childReq);
  expectApprovedDelta(before, after, xp, label);
  return { before, after };
}

/** 親の UI: 承認センターで自分のカードを承認し、pt が +1 になることまで確認する */
export async function approveViaParentUi(s: Sessions, page: Page, title: string, questId: string, label: string) {
  await ensureXpHeadroom(s.parentReq, s.childReq, s.childId);
  const before = await getMonsterSnapshot(s.childReq);
  const card = await gotoApproveCard(page, title);
  const approveButton = card.getByRole("button", { name: "✓ 承認 (+1pt)" });
  await expect(approveButton, PREMISE_MESSAGE).toBeVisible();
  await clickAndExpect2xx(page, approveButton, new RegExp(`^/api/approve/${questId}$`));
  await expect(card).toHaveCount(0, { timeout: 10000 });
  const after = await getMonsterSnapshot(s.childReq);
  expectApprovedDelta(before, after, 1, label);
}

/** 子の GET /api/quests/today から見たクエストのステータス */
export async function childStatus(s: Sessions, title: string): Promise<QuestStatus> {
  return (await getTodayQuestByTitle(s.childReq, title)).status;
}

export async function childRejectionReason(s: Sessions, title: string): Promise<string | null> {
  const quests = await callApi<{ rejectionReason: string | null; template: { title: string } }[]>(
    s.childReq,
    "GET",
    "/api/quests/today",
  );
  const q = quests.find((x) => x.template.title === title);
  if (!q) throw new Error(`クエスト「${title}」が見つかりません`);
  return q.rejectionReason ?? null;
}

/** 承認待ちを API で空にする（「まとめて承認」は承認待ち全件を処理するため、同じ spec の前のテストの残りを先に片付ける） */
export async function drainPending(s: Sessions) {
  const items = await callApi<{ kind: "quest" | "treasure_use"; id: string }[]>(
    s.parentReq,
    "GET",
    "/api/approve/pending",
  );
  if (items.length > 0) {
    await callApi(s.parentReq, "POST", "/api/approve/bulk", {
      items: items.map((i) => ({ kind: i.kind, id: i.id })),
    });
  }
}

// ---------- 使い捨ての家族（#240） ----------

/** PREMIUM の使い捨て家族を作り、s32 / s33 の Sessions として返す。s.dispose() で家族ごと削除する */
export async function openFamilySessions(browser: Browser): Promise<{ s: Sessions; family: DisposableFamily }> {
  const family = await createDisposableFamily(browser, { premium: true });
  const s: Sessions = {
    parentReq: family.parent.request,
    childReq: family.child.request,
    childId: family.childId,
    dispose: family.disposeFamily,
  };
  return { s, family };
}

/** 使い捨て家族の親のページを開く（createDisposableFamily の context には bypass の route が張られていない） */
export async function newParentPage(family: DisposableFamily): Promise<Page> {
  const page = await family.parent.context.newPage();
  await setupBypassRoute(page);
  return page;
}

/** 子のブラウザコンテキストでページを開き、fn の後に必ず閉じる */
export async function withChildPage(childContext: BrowserContext, fn: (childPage: Page) => Promise<void>) {
  const page = await childContext.newPage();
  try {
    await fn(page);
  } finally {
    await page.close();
  }
}
