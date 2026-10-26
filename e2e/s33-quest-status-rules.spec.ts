/**
 * S33: クエストのステータス遷移ルール（HTTP レベル。UI は使わない）（Issue #222）
 * 前提: as-parent-premium プロジェクトで実行（親と子の APIRequestContext だけを使う）。
 *   共有の QA アカウントは使わず、使い捨ての家族（#240）で実行する（共有の QA_child の XP を動かさないため）。
 *
 * 許可されていない遷移は 4xx で拒否され、クエストの状態と子の XP が変わらないことを確認する。
 * 各ケースで (1) ステータスコード (2) 操作後のクエストの状態（子の GET /api/quests/today）
 * (3) XP 付与系は pt が変わっていないこと、を確認する。
 *
 * s30 でカバー済みのため作らないもの:
 * - 子のセッションで POST /api/approve/[id] と POST /api/approve/bulk → 403
 * - 子 A のセッションで子 B（QA_child2）のクエストを report / skip → 404
 *
 * 対象外（Issue #222 の回答）: #183 の同時承認、action が不正な値のときの挙動、新しい家族の作成。
 */
import { test, expect } from "./fixtures";
import {
  approveQuest,
  seedQuestInStatus,
  type QuestStatus,
  type Sessions,
} from "./helpers/testData";
import { ensureXpHeadroom, setReportDeadline } from "./helpers/photoXp";
import { getMonsterSnapshot } from "./helpers/monsterSnapshot";
import { postRaw } from "./helpers/rawPost";
import {
  childRejectionReason,
  childStatus,
  expectApprovedDelta,
  expectPtUnchanged,
  openFamilySessions,
} from "./helpers/questFlow";

const NOT_FOUND_ID = "00000000-0000-4000-8000-000000000000";

let s: Sessions;

test.beforeAll(async ({ browser }) => {
  test.setTimeout(120_000);
  ({ s } = await openFamilySessions(browser));
});
test.afterAll(async () => {
  await s?.dispose();
});
test.beforeEach(async () => {
  await setReportDeadline(s.parentReq, s.childId, null);
  await ensureXpHeadroom(s.parentReq, s.childReq, s.childId);
});

// ---------- 操作ヘルパー（この spec 内だけで使う。共通部分は helpers/questFlow.ts） ----------

const approveBody = { kind: "quest", action: "approve" };
const rejectBody = (extra: Record<string, unknown> = {}) => ({ kind: "quest", action: "reject", ...extra });

/** 親が POST /api/approve/[id] して 400、状態と pt が不変であることを確認する */
async function expectParentActionRejected400(
  status: QuestStatus,
  body: Record<string, unknown>,
  tag: string,
) {
  const { questId, title } = await seedQuestInStatus(s, status, { tag });
  const before = await getMonsterSnapshot(s.childReq);
  const res = await postRaw(s.parentReq, `/api/approve/${questId}`, body);
  expect(res.status, `body=${res.body}`).toBe(400);
  expect(await childStatus(s, title), "状態は変わらない").toBe(status);
  expectPtUnchanged(before, await getMonsterSnapshot(s.childReq), "拒否された操作の前後");
}

/** 子が report / skip して 400、状態が不変であることを確認する */
async function expectChildActionRejected400(
  status: QuestStatus,
  action: "report" | "skip",
  tag: string,
) {
  const { questId, title } = await seedQuestInStatus(s, status, { tag });
  const before = await getMonsterSnapshot(s.childReq);
  const data = action === "skip" ? { comment: "E2E 理由" } : { comment: "E2E 報告" };
  const res = await postRaw(s.childReq, `/api/quests/${questId}/${action}`, data);
  expect(res.status, `body=${res.body}`).toBe(400);
  expect(await childStatus(s, title), "状態は変わらない").toBe(status);
  expectPtUnchanged(before, await getMonsterSnapshot(s.childReq), "拒否された操作の前後");
}

// ---------- 親の承認・差し戻し ----------

test.describe("S33: 許可されていない承認・差し戻しは 400 で何も変わらない", () => {
  test("R1: APPROVED を再承認 → 400。XP が二重に付かない（#183 の逐次版の回帰）", async () => {
    await expectParentActionRejected400("APPROVED", approveBody, "s33r1");
  });

  test("APPROVED を差し戻す → 400。APPROVED のまま", async () => {
    await expectParentActionRejected400("APPROVED", rejectBody({ rejectionReason: "やり直し" }), "s33ap");
  });

  test("PENDING（未報告）を承認 → 400", async () => {
    await expectParentActionRejected400("PENDING", approveBody, "s33pe");
  });

  test("REJECTED を承認 → 400（子の再報告を経ずに承認できない）", async () => {
    await expectParentActionRejected400("REJECTED", approveBody, "s33rj");
  });

  test("SKIPPED を承認 → 400", async () => {
    await expectParentActionRejected400("SKIPPED", approveBody, "s33sa");
  });

  test("SKIPPED を差し戻し → 400", async () => {
    await expectParentActionRejected400("SKIPPED", rejectBody({ rejectionReason: "やり直し" }), "s33sr");
  });
});

// ---------- 子の報告・スキップ ----------

test.describe("S33: 子の不正な報告・スキップ申請は 400 で何も変わらない", () => {
  test("REPORTED をもう一度報告 → 400", async () => {
    await expectChildActionRejected400("REPORTED", "report", "s33cr");
  });

  for (const status of ["APPROVED", "SKIPPED", "SKIP_REPORTED"] as const) {
    test(`${status} を報告 → 400`, async () => {
      await expectChildActionRejected400(status, "report", `s33r${status.slice(0, 3)}`);
    });
  }

  for (const status of ["REPORTED", "APPROVED", "SKIPPED", "SKIP_REPORTED"] as const) {
    test(`${status} をスキップ申請 → 400`, async () => {
      await expectChildActionRejected400(status, "skip", `s33k${status.slice(0, 3)}`);
    });
  }
});

// ---------- 境界値 ----------

test.describe("S33: 境界値", () => {
  test("差し戻しで rejectionReason なし → 400。REPORTED のまま", async () => {
    await expectParentActionRejected400("REPORTED", rejectBody(), "s33b1");
  });

  test("差し戻しで rejectionReason が空文字 → 400。REPORTED のまま", async () => {
    await expectParentActionRejected400("REPORTED", rejectBody({ rejectionReason: "" }), "s33b2");
  });

  for (const [label, extra] of [
    ["rejectionComment が空文字", { rejectionComment: "" }],
    ["rejectionComment が空白だけ", { rejectionComment: "   " }],
    ["rejectionComment なし", {}],
  ] as const) {
    test(`「その他」で ${label} → 400。REPORTED のまま`, async () => {
      await expectParentActionRejected400(
        "REPORTED",
        rejectBody({ rejectionReason: "その他", ...extra }),
        "s33b3",
      );
    });
  }

  test("「その他」で前後に空白のある ' 理由 ' → 2xx。保存された理由は trim 済みの '理由'", async () => {
    const { questId, title } = await seedQuestInStatus(s, "REPORTED", { tag: "s33b4" });
    const before = await getMonsterSnapshot(s.childReq);
    const res = await postRaw(
      s.parentReq,
      `/api/approve/${questId}`,
      rejectBody({ rejectionReason: "その他", rejectionComment: " 理由 " }),
    );
    expect(res.status, `body=${res.body}`).toBeGreaterThanOrEqual(200);
    expect(res.status, `body=${res.body}`).toBeLessThan(300);
    expect(await childStatus(s, title)).toBe("REJECTED");
    expect(await childRejectionReason(s, title)).toBe("理由");
    expectPtUnchanged(before, await getMonsterSnapshot(s.childReq), "差し戻しの前後");
  });

  for (const [label, comment] of [
    ["空", ""],
    ["空白だけ", "   "],
  ] as const) {
    test(`スキップ申請の理由が${label} → 400。PENDING のまま`, async () => {
      const { questId, title } = await seedQuestInStatus(s, "PENDING", { tag: "s33b5" });
      const res = await postRaw(s.childReq, `/api/quests/${questId}/skip`, { comment });
      expect(res.status, `body=${res.body}`).toBe(400);
      expect(await childStatus(s, title)).toBe("PENDING");
    });
  }

  test("スキップ申請で comment が無い → 400。PENDING のまま", async () => {
    const { questId, title } = await seedQuestInStatus(s, "PENDING", { tag: "s33b6" });
    const res = await postRaw(s.childReq, `/api/quests/${questId}/skip`, {});
    expect(res.status, `body=${res.body}`).toBe(400);
    expect(await childStatus(s, title)).toBe("PENDING");
  });

  test("存在しない id で承認 → 404", async () => {
    const res = await postRaw(s.parentReq, `/api/approve/${NOT_FOUND_ID}`, approveBody);
    expect(res.status, `body=${res.body}`).toBe(404);
  });

  test("存在しない id で報告 → 404", async () => {
    const res = await postRaw(s.childReq, `/api/quests/${NOT_FOUND_ID}/report`, { comment: "E2E" });
    expect(res.status, `body=${res.body}`).toBe(404);
  });
});

// ---------- まとめて承認 ----------

test.describe("S33: まとめて承認 POST /api/approve/bulk", () => {
  test("all-or-nothing: REPORTED 1件と APPROVED 1件を一緒に送る → 400。REPORTED のほうも REPORTED のまま", async () => {
    const reported = await seedQuestInStatus(s, "REPORTED", { tag: "s33k1" });
    const approved = await seedQuestInStatus(s, "APPROVED", { tag: "s33k2" });
    const before = await getMonsterSnapshot(s.childReq);

    const res = await postRaw(s.parentReq, "/api/approve/bulk", {
      items: [
        { kind: "quest", id: reported.questId },
        { kind: "quest", id: approved.questId },
      ],
    });
    expect(res.status, `body=${res.body}`).toBe(400);
    expect(await childStatus(s, reported.title), "REPORTED のほうも処理されない").toBe("REPORTED");
    expect(await childStatus(s, approved.title)).toBe("APPROVED");
    expectPtUnchanged(before, await getMonsterSnapshot(s.childReq), "拒否された一括承認の前後");
  });

  test("all-or-nothing: REPORTED 1件と存在しない id を一緒に送る → 400。REPORTED のまま", async () => {
    const reported = await seedQuestInStatus(s, "REPORTED", { tag: "s33k3" });
    const before = await getMonsterSnapshot(s.childReq);

    const res = await postRaw(s.parentReq, "/api/approve/bulk", {
      items: [
        { kind: "quest", id: reported.questId },
        { kind: "quest", id: NOT_FOUND_ID },
      ],
    });
    expect(res.status, `body=${res.body}`).toBe(400);
    expect(await childStatus(s, reported.title)).toBe("REPORTED");
    expectPtUnchanged(before, await getMonsterSnapshot(s.childReq), "拒否された一括承認の前後");
  });

  test("同じ id を2回入れる → 400。どちらも処理されない", async () => {
    const reported = await seedQuestInStatus(s, "REPORTED", { tag: "s33k4" });
    const before = await getMonsterSnapshot(s.childReq);

    const item = { kind: "quest", id: reported.questId };
    const res = await postRaw(s.parentReq, "/api/approve/bulk", { items: [item, item] });
    expect(res.status, `body=${res.body}`).toBe(400);
    expect(await childStatus(s, reported.title)).toBe("REPORTED");
    expectPtUnchanged(before, await getMonsterSnapshot(s.childReq), "拒否された一括承認の前後");
  });

  test("items: [] → 2xx で count: 0", async () => {
    const res = await postRaw(s.parentReq, "/api/approve/bulk", { items: [] });
    expect(res.status, `body=${res.body}`).toBe(200);
    expect(JSON.parse(res.body)).toMatchObject({ ok: true, count: 0 });
  });

  test("旧形式 { ids: [REPORTED の id] } → 2xx で count: 1、APPROVED になり pt が +1", async () => {
    const reported = await seedQuestInStatus(s, "REPORTED", { tag: "s33k5" });
    await ensureXpHeadroom(s.parentReq, s.childReq, s.childId);
    const before = await getMonsterSnapshot(s.childReq);

    const res = await postRaw(s.parentReq, "/api/approve/bulk", { ids: [reported.questId] });
    expect(res.status, `body=${res.body}`).toBe(200);
    expect(JSON.parse(res.body)).toMatchObject({ ok: true, count: 1 });
    expect(await childStatus(s, reported.title)).toBe("APPROVED");
    expectApprovedDelta(before, await getMonsterSnapshot(s.childReq), 1, "旧形式の一括承認");
  });

  test("承認の直後に同じ id を再度承認 → 400（APPROVED のまま・pt 不変）", async () => {
    const reported = await seedQuestInStatus(s, "REPORTED", { tag: "s33k6" });
    await approveQuest(s.parentReq, reported.questId, { action: "approve" });
    const before = await getMonsterSnapshot(s.childReq);

    const res = await postRaw(s.parentReq, "/api/approve/bulk", {
      items: [{ kind: "quest", id: reported.questId }],
    });
    expect(res.status, `body=${res.body}`).toBe(400);
    expect(await childStatus(s, reported.title)).toBe("APPROVED");
    expectPtUnchanged(before, await getMonsterSnapshot(s.childReq), "再承認の前後");
  });
});
