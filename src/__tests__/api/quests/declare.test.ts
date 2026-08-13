import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/quests/[id]/declare/route";
import { getCurrentUser } from "@/lib/auth";
import { makeRequest, makeParams } from "../../helpers/request";
import { prismaMock } from "../../helpers/prisma-mock";
import { childUserWithFamily, parentUserWithFamily, questInstance, taskTemplate, questDeclaration } from "../../helpers/fixtures";
import type { Prisma } from "@/generated/prisma/client";

type DeclareQuest = Prisma.QuestInstanceGetPayload<{
  include: { template: { select: { carryOver: true } } };
}>;

const mockGetCurrentUser = vi.mocked(getCurrentUser);

beforeEach(() => {
  vi.clearAllMocks();
});

const day = (s: string) => new Date(s + "T00:00:00.000Z");

/**
 * findMany の select: { date, status } 相当のルックバック用データ。
 * DeepMockProxy の mockResolvedValue はベースの QuestInstance 完全型を要求するため、
 * questInstance() フィクスチャで他フィールドを埋める。
 */
function lookback(overrides: { date: Date; status: NonNullable<Parameters<typeof questInstance>[0]>["status"] }) {
  return questInstance(overrides);
}

describe("POST /api/quests/[id]/declare", () => {
  it("未認証なら 401 を返す", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await POST(makeRequest("/api/quests/q1/declare", {}), makeParams("q1"));
    expect(res.status).toBe(401);
    expect(prismaMock.questDeclaration.upsert).not.toHaveBeenCalled();
  });

  it("親ロールは 403", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    const res = await POST(makeRequest("/api/quests/q1/declare", {}), makeParams("q1"));
    expect(res.status).toBe(403);
    expect(prismaMock.questDeclaration.upsert).not.toHaveBeenCalled();
  });

  it("自分のクエストでなければ 404", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    prismaMock.questInstance.findUnique.mockResolvedValue(null);
    const res = await POST(makeRequest("/api/quests/q-other/declare", {}), makeParams("q-other"));
    expect(res.status).toBe(404);
    expect(prismaMock.questDeclaration.upsert).not.toHaveBeenCalled();
  });

  it("status が REPORTED の場合は 400（既にアクション済み）", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    const quest: DeclareQuest = {
      ...questInstance({ id: "q1", status: "REPORTED", templateId: "tpl-1", childId: "child-1" }),
      template: taskTemplate({ carryOver: false }),
    };
    prismaMock.questInstance.findUnique.mockResolvedValue(quest);
    prismaMock.questInstance.findMany.mockResolvedValue([]);
    const res = await POST(makeRequest("/api/quests/q1/declare", {}), makeParams("q1"));
    expect(res.status).toBe(400);
    expect(prismaMock.questDeclaration.upsert).not.toHaveBeenCalled();
  });

  it("週次タスクで先週スキップしただけの場合は 400（missedExposures=2 < 3）", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    const quest: DeclareQuest = {
      ...questInstance({ id: "q-week", status: "PENDING", templateId: "tpl-week", childId: "child-1" }),
      template: taskTemplate({ carryOver: false }),
    };
    prismaMock.questInstance.findUnique.mockResolvedValue(quest);
    // 今日(月) PENDING + 先週(月) SKIPPED + 先々週(月) APPROVED
    prismaMock.questInstance.findMany.mockResolvedValue([
      lookback({ date: day("2026-05-11"), status: "PENDING" }),
      lookback({ date: day("2026-05-04"), status: "SKIPPED" }),
      lookback({ date: day("2026-04-27"), status: "APPROVED" }),
    ]);
    const res = await POST(makeRequest("/api/quests/q-week/declare", {}), makeParams("q-week"));
    expect(res.status).toBe(400);
    expect(prismaMock.questDeclaration.upsert).not.toHaveBeenCalled();
  });

  it("3週連続非APPROVED なら宣言成功（missedExposures=3）", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    const quest: DeclareQuest = {
      ...questInstance({ id: "q-week", status: "PENDING", templateId: "tpl-week", childId: "child-1" }),
      template: taskTemplate({ carryOver: false }),
    };
    prismaMock.questInstance.findUnique.mockResolvedValue(quest);
    prismaMock.questInstance.findMany.mockResolvedValue([
      lookback({ date: day("2026-05-11"), status: "PENDING" }),
      lookback({ date: day("2026-05-04"), status: "SKIPPED" }),
      lookback({ date: day("2026-04-27"), status: "SKIPPED" }),
      lookback({ date: day("2026-04-20"), status: "APPROVED" }),
    ]);
    prismaMock.questDeclaration.upsert.mockResolvedValue(questDeclaration());

    const res = await POST(makeRequest("/api/quests/q-week/declare", {}), makeParams("q-week"));
    expect(res.status).toBe(200);
    expect(prismaMock.questDeclaration.upsert).toHaveBeenCalled();
  });

  it("毎日タスクで3日連続非APPROVED なら宣言成功", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    const quest: DeclareQuest = {
      ...questInstance({ id: "q-daily", status: "PENDING", templateId: "tpl-daily", childId: "child-1" }),
      template: taskTemplate({ carryOver: false }),
    };
    prismaMock.questInstance.findUnique.mockResolvedValue(quest);
    prismaMock.questInstance.findMany.mockResolvedValue([
      lookback({ date: day("2026-05-09"), status: "PENDING" }),
      lookback({ date: day("2026-05-08"), status: "PENDING" }),
      lookback({ date: day("2026-05-07"), status: "PENDING" }),
      lookback({ date: day("2026-05-06"), status: "APPROVED" }),
    ]);
    prismaMock.questDeclaration.upsert.mockResolvedValue(questDeclaration());

    const res = await POST(makeRequest("/api/quests/q-daily/declare", {}), makeParams("q-daily"));
    expect(res.status).toBe(200);
  });

  it("carryOver: instance.date が3日以上前なら宣言成功（暦日基準）", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    // 今日のシステム時刻を 5/9 に固定
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-09T09:00:00"));

    const quest: DeclareQuest = {
      ...questInstance({ id: "q-carry", status: "PENDING", templateId: "tpl-carry", childId: "child-1" }),
      template: taskTemplate({ carryOver: true }),
    };
    prismaMock.questInstance.findUnique.mockResolvedValue(quest);
    // carryOver で 5/7 に作成された PENDING が今日まで残っている
    prismaMock.questInstance.findMany.mockResolvedValue([
      lookback({ date: day("2026-05-07"), status: "PENDING" }),
      lookback({ date: day("2026-05-06"), status: "APPROVED" }),
    ]);
    prismaMock.questDeclaration.upsert.mockResolvedValue(questDeclaration());

    const res = await POST(makeRequest("/api/quests/q-carry/declare", {}), makeParams("q-carry"));
    expect(res.status).toBe(200);
    vi.useRealTimers();
  });

  it("REJECTED かつ閾値到達なら宣言可能", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    const quest: DeclareQuest = {
      ...questInstance({ id: "q-rej", status: "REJECTED", templateId: "tpl-1", childId: "child-1" }),
      template: taskTemplate({ carryOver: false }),
    };
    prismaMock.questInstance.findUnique.mockResolvedValue(quest);
    prismaMock.questInstance.findMany.mockResolvedValue([
      lookback({ date: day("2026-05-09"), status: "REJECTED" }),
      lookback({ date: day("2026-05-08"), status: "PENDING" }),
      lookback({ date: day("2026-05-07"), status: "PENDING" }),
    ]);
    prismaMock.questDeclaration.upsert.mockResolvedValue(questDeclaration());
    const res = await POST(makeRequest("/api/quests/q-rej/declare", {}), makeParams("q-rej"));
    expect(res.status).toBe(200);
  });

  it("二重押しでも upsert なので冪等（200）", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    const quest: DeclareQuest = {
      ...questInstance({ id: "q1", status: "PENDING", templateId: "tpl-1", childId: "child-1" }),
      template: taskTemplate({ carryOver: false }),
    };
    prismaMock.questInstance.findUnique.mockResolvedValue(quest);
    prismaMock.questInstance.findMany.mockResolvedValue([
      lookback({ date: day("2026-05-09"), status: "PENDING" }),
      lookback({ date: day("2026-05-08"), status: "PENDING" }),
      lookback({ date: day("2026-05-07"), status: "PENDING" }),
    ]);
    prismaMock.questDeclaration.upsert.mockResolvedValue(questDeclaration());

    const res1 = await POST(makeRequest("/api/quests/q1/declare", {}), makeParams("q1"));
    const res2 = await POST(makeRequest("/api/quests/q1/declare", {}), makeParams("q1"));
    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(prismaMock.questDeclaration.upsert).toHaveBeenCalledTimes(2);
  });
});
