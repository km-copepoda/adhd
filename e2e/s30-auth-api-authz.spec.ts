/**
 * S30: API の認可（未認証・ロール違い・兄弟・他の家族）（Issue #224）
 * 前提: as-parent-premium プロジェクト。共有の parent.json / child-light.json は読むだけ。
 *
 * 書き込み系は 2xx にならず（ロール違いは [401, 403]、他人のリソースは [403, 404]）、読み直して状態が変わっていない。
 * 読み取り系は 2xx 以外か空のデータ。どのケースも 500 にならない。
 * 期待値は現在の実装を仕様とする（#184 は修正済み。#186 / #215 は対象外）。他の家族は createFreshFamily で作る。
 */
import { request as playwrightRequest } from "@playwright/test";
import type { APIRequestContext, BrowserContext } from "@playwright/test";
import path from "path";
import { test, expect } from "./fixtures";
import { getE2EBaseUrl } from "./baseUrl";
import { AUTH_DIR, createBrowserContext, getBypassHeaders, readCredentials } from "./credentials";
import { createAnonymousContext } from "./helpers/authGuard";
import { createFreshFamily } from "./helpers/freshFamily";
import {
  getChildMembers,
  openSessions,
  seedQuestInStatus,
  uniqueTitle,
  type SeededQuest,
  type Sessions,
} from "./helpers/testData";
import { getChildPoints, getReportDeadline } from "./helpers/photoXp";
import {
  DENIED_OTHER,
  DENIED_ROLE,
  expectDenied,
  expectNoData,
  parentTasksJson,
  readQuestStatus,
  seedPendingQuest,
} from "./helpers/authzAssert";

let s: Sessions;
let anonCtx: BrowserContext;
let childCtx: BrowserContext;
let otherFamilyReq: APIRequestContext;
let child2Id: string;
let reportedOwn: SeededQuest;
let pendingOwn: SeededQuest;
let pendingChild2: { taskId: string; questId: string; title: string };
const createdTaskIds: string[] = [];

function headers() {
  return getBypassHeaders();
}

test.beforeAll(async ({ browser }) => {
  s = await openSessions();
  child2Id = readCredentials().childIdLight2 ?? "";
  expect(child2Id, "QA_child2 の ID（auth.setup.ts が作成）").not.toBe("");

  anonCtx = (await createAnonymousContext(browser)).context;
  childCtx = (await createBrowserContext(browser, path.join(AUTH_DIR, "child-light.json"))).context;

  reportedOwn = await seedQuestInStatus(s, "REPORTED", { tag: "authzR" });
  pendingOwn = await seedQuestInStatus(s, "PENDING", { tag: "authzP" });
  createdTaskIds.push(reportedOwn.taskId, pendingOwn.taskId);

  pendingChild2 = await seedPendingQuest(s.parentReq, child2Id, "authzC2");
  createdTaskIds.push(pendingChild2.taskId);

  // 他の家族（新しく作る）の親のセッション
  const { parentStatePath } = await createFreshFamily(browser);
  otherFamilyReq = await playwrightRequest.newContext({ baseURL: getE2EBaseUrl(), storageState: parentStatePath });
});

test.afterAll(async () => {
  // 承認センターの件数を見る他の spec の邪魔をしないよう、一時タスクを片付ける
  for (const id of createdTaskIds) {
    await s?.parentReq.delete(`/api/tasks/${id}`, { headers: headers() }).catch(() => undefined);
  }
  await otherFamilyReq?.dispose();
  await anonCtx?.close();
  await childCtx?.close();
  await s?.dispose();
});

test.describe("S30: 未認証", () => {
  test("GET /api/parent/child-view/children / GET /api/subscription/status は 401/403", async () => {
    for (const url of ["/api/parent/child-view/children", "/api/subscription/status"]) {
      const res = await anonCtx.request.get(url, { headers: headers() });
      await expectDenied(res, DENIED_ROLE);
      expect(res.headers()["content-type"]).toContain("application/json");
    }
  });

  test("POST /api/tasks は拒否され、タスクが作られない", async () => {
    const title = uniqueTitle("authzAnon");
    const res = await anonCtx.request.post("/api/tasks", {
      headers: headers(),
      data: { title, emoji: "⚔️", category: "LIFE", assignedChildId: s.childId, isTemporary: true },
    });
    await expectDenied(res, DENIED_ROLE);
    expect(await parentTasksJson(s.parentReq)).not.toContain(title);
  });

  test("POST /api/family/members は拒否され、子の人数が変わらない", async () => {
    const before = (await getChildMembers(s.parentReq)).length;
    const res = await anonCtx.request.post("/api/family/members", {
      headers: headers(),
      data: { monsterName: "QA_authz_anon", side: "LIGHT" },
    });
    await expectDenied(res, DENIED_ROLE);
    expect((await getChildMembers(s.parentReq)).length).toBe(before);
  });

  test("PATCH /api/family/settings は拒否され、報告期限が変わらない", async () => {
    const before = await getReportDeadline(s.parentReq, s.childId);
    const res = await anonCtx.request.patch("/api/family/settings", {
      headers: headers(),
      data: { childId: s.childId, reportDeadlineTime: "06:30" },
    });
    await expectDenied(res, DENIED_ROLE);
    expect(await getReportDeadline(s.parentReq, s.childId)).toBe(before);
  });

  test("POST /api/approve/<REPORTED> は拒否され、REPORTED のまま", async () => {
    const res = await anonCtx.request.post(`/api/approve/${reportedOwn.questId}`, {
      headers: headers(),
      data: { kind: "quest", action: "approve" },
    });
    await expectDenied(res, DENIED_ROLE);
    expect(await readQuestStatus(s.parentReq, s.childId, reportedOwn.title)).toBe("REPORTED");
  });

  test("POST /api/quests/<PENDING>/report は拒否され、PENDING のまま", async () => {
    const res = await anonCtx.request.post(`/api/quests/${pendingOwn.questId}/report`, {
      headers: headers(),
      data: {},
    });
    await expectDenied(res, DENIED_ROLE);
    expect(await readQuestStatus(s.parentReq, s.childId, pendingOwn.title)).toBe("PENDING");
  });

  test("読み取り系は空のデータ（または 2xx 以外）", async () => {
    await expectNoData(await anonCtx.request.get("/api/approve/pending", { headers: headers() }), []);
    await expectNoData(await anonCtx.request.get("/api/nav/pending-counts", { headers: headers() }), {
      approvals: 0,
      tasks: 0,
    });
    await expectNoData(await anonCtx.request.get("/api/quests/today", { headers: headers() }), []);
    await expectNoData(await anonCtx.request.get("/api/family/code", { headers: headers() }), {
      code: null,
      members: [],
    });
  });
});

test.describe("S30: 子のセッションで親専用 API", () => {
  test("自分の REPORTED を自分で承認できず、REPORTED のまま・XP も変わらない", async () => {
    const before = await getChildPoints(s.parentReq, s.childId);
    const res = await childCtx.request.post(`/api/approve/${reportedOwn.questId}`, {
      headers: headers(),
      data: { kind: "quest", action: "approve" },
    });
    await expectDenied(res, DENIED_ROLE);
    expect(await readQuestStatus(s.parentReq, s.childId, reportedOwn.title)).toBe("REPORTED");
    expect(await getChildPoints(s.parentReq, s.childId)).toEqual(before);
  });

  test("POST /api/approve/bulk は拒否され、REPORTED のまま", async () => {
    const res = await childCtx.request.post("/api/approve/bulk", {
      headers: headers(),
      data: { items: [{ kind: "quest", id: reportedOwn.questId }] },
    });
    await expectDenied(res, DENIED_ROLE);
    expect(await readQuestStatus(s.parentReq, s.childId, reportedOwn.title)).toBe("REPORTED");
  });

  test("POST /api/tasks/bulk は拒否され、タスクが作られない", async () => {
    const title = uniqueTitle("authzBulk");
    const res = await childCtx.request.post("/api/tasks/bulk", {
      headers: headers(),
      data: { assignedChildId: s.childId, tasks: [{ title, category: "LIFE", repeatDays: [1] }] },
    });
    await expectDenied(res, DENIED_ROLE);
    expect(await parentTasksJson(s.parentReq)).not.toContain(title);
  });

  test("POST /api/family/members は拒否され、子の人数が変わらない", async () => {
    const before = (await getChildMembers(s.parentReq)).length;
    const res = await childCtx.request.post("/api/family/members", {
      headers: headers(),
      data: { monsterName: "QA_authz_child", side: "LIGHT" },
    });
    await expectDenied(res, DENIED_ROLE);
    expect((await getChildMembers(s.parentReq)).length).toBe(before);
  });

  test("PATCH /api/family/settings は拒否され、報告期限が変わらない", async () => {
    const before = await getReportDeadline(s.parentReq, s.childId);
    const res = await childCtx.request.patch("/api/family/settings", {
      headers: headers(),
      data: { childId: s.childId, reportDeadlineTime: "06:30" },
    });
    await expectDenied(res, DENIED_ROLE);
    expect(await getReportDeadline(s.parentReq, s.childId)).toBe(before);
  });

  test("親専用の GET（treasures/pending・child-view/children・subscription/status）は 401/403", async () => {
    for (const url of [
      "/api/treasures/pending",
      "/api/parent/child-view/children",
      "/api/subscription/status",
    ]) {
      await expectDenied(await childCtx.request.get(url, { headers: headers() }), DENIED_ROLE);
    }
  });

  test("GET /api/approve/pending・nav/pending-counts は空のデータ", async () => {
    await expectNoData(await childCtx.request.get("/api/approve/pending", { headers: headers() }), []);
    await expectNoData(await childCtx.request.get("/api/nav/pending-counts", { headers: headers() }), {
      approvals: 0,
      tasks: 0,
    });
  });

  test("GET /api/family/code は自分の行だけ。兄弟の行と家族コードは返らない（#184 修正済み）", async () => {
    const res = await childCtx.request.get("/api/family/code", { headers: headers() });
    expect(res.status()).toBe(200);
    const data = (await res.json()) as { code: string | null; members: { id: string }[] };
    expect(data.code).toBeNull();
    expect(data.members.map((m) => m.id)).toEqual([s.childId]);
    expect(JSON.stringify(data)).not.toContain(child2Id);
  });
});

test.describe("S30: 親のセッションで子用 API", () => {
  test("POST /api/quests/<子の PENDING>/report は 2xx にならず、PENDING のまま", async () => {
    const res = await s.parentReq.post(`/api/quests/${pendingOwn.questId}/report`, {
      headers: headers(),
      data: {},
    });
    await expectDenied(res, [401, 403, 404]);
    expect(await readQuestStatus(s.parentReq, s.childId, pendingOwn.title)).toBe("PENDING");
  });
});

test.describe("S30: 兄弟（QA_child -> QA_child2 のクエスト）", () => {
  test("report は 2xx にならず、PENDING のまま", async () => {
    const res = await s.childReq.post(`/api/quests/${pendingChild2.questId}/report`, {
      headers: headers(),
      data: {},
    });
    await expectDenied(res, DENIED_OTHER);
    expect(await readQuestStatus(s.parentReq, child2Id, pendingChild2.title)).toBe("PENDING");
  });

  test("skip は 2xx にならず、PENDING のまま", async () => {
    const res = await s.childReq.post(`/api/quests/${pendingChild2.questId}/skip`, {
      headers: headers(),
      data: { comment: "兄弟のクエストをスキップしたい" },
    });
    await expectDenied(res, DENIED_OTHER);
    expect(await readQuestStatus(s.parentReq, child2Id, pendingChild2.title)).toBe("PENDING");
  });
});

test.describe("S30: 他の家族（新しい家族の親 -> QA 家族のクエスト・タスク）", () => {
  test("POST /api/approve/<QA 家族の REPORTED> は 403/404 で、REPORTED のまま", async () => {
    const before = await getChildPoints(s.parentReq, s.childId);
    const res = await otherFamilyReq.post(`/api/approve/${reportedOwn.questId}`, {
      headers: headers(),
      data: { kind: "quest", action: "approve" },
    });
    await expectDenied(res, DENIED_OTHER);
    expect(await readQuestStatus(s.parentReq, s.childId, reportedOwn.title)).toBe("REPORTED");
    expect(await getChildPoints(s.parentReq, s.childId)).toEqual(before);
  });

  // PATCH は prisma.taskTemplate.update（該当なしだと例外）を直接呼ぶため、他家族のタスクで 500 になる。
  // 認可とは別のアプリのバグ（#237）。直ったら fixme を外す。
  test("PATCH /api/tasks/<QA 家族のタスク> は 403/404 で、タスクが残る", async () => {
    test.fixme(true, "PATCH /api/tasks/[id] が他家族のタスクで 500 を返す（#237）");
    const res = await otherFamilyReq.patch(`/api/tasks/${pendingOwn.taskId}`, { headers: headers() });
    await expectDenied(res, DENIED_OTHER);
    expect(await parentTasksJson(s.parentReq)).toContain(pendingOwn.title);
    expect(await readQuestStatus(s.parentReq, s.childId, pendingOwn.title)).toBe("PENDING");
  });

  test("DELETE /api/tasks/<QA 家族のタスク> は 403/404 で、タスクが残る", async () => {
    const res = await otherFamilyReq.delete(`/api/tasks/${pendingOwn.taskId}`, { headers: headers() });
    await expectDenied(res, DENIED_OTHER);
    expect(await parentTasksJson(s.parentReq)).toContain(pendingOwn.title);
    expect(await readQuestStatus(s.parentReq, s.childId, pendingOwn.title)).toBe("PENDING");
  });

  test("GET /api/approve/pending に QA 家族のクエストが含まれない", async () => {
    const res = await otherFamilyReq.get("/api/approve/pending", { headers: headers() });
    expect(res.status()).toBe(200);
    const text = JSON.stringify(await res.json());
    expect(text).not.toContain(reportedOwn.questId);
    expect(text).not.toContain(reportedOwn.title);
  });
});
