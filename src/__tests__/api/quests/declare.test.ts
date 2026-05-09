import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/quests/[id]/declare/route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { makeRequest, makeParams } from "../../helpers/request";
import { childUser, parentUser } from "../../helpers/fixtures";

const mockPrisma = vi.mocked(prisma);
const mockGetCurrentUser = vi.mocked(getCurrentUser);

beforeEach(() => {
  vi.clearAllMocks();
});

const day = (s: string) => new Date(s + "T00:00:00.000Z");

describe("POST /api/quests/[id]/declare", () => {
  it("未認証なら 401 を返す", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await POST(makeRequest("/api/quests/q1/declare", {}), makeParams("q1"));
    expect(res.status).toBe(401);
    expect(mockPrisma.questDeclaration.upsert).not.toHaveBeenCalled();
  });

  it("親ロールは 403", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    const res = await POST(makeRequest("/api/quests/q1/declare", {}), makeParams("q1"));
    expect(res.status).toBe(403);
    expect(mockPrisma.questDeclaration.upsert).not.toHaveBeenCalled();
  });

  it("自分のクエストでなければ 404", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as any);
    mockPrisma.questInstance.findUnique.mockResolvedValue(null);
    const res = await POST(makeRequest("/api/quests/q-other/declare", {}), makeParams("q-other"));
    expect(res.status).toBe(404);
    expect(mockPrisma.questDeclaration.upsert).not.toHaveBeenCalled();
  });

  it("status が REPORTED の場合は 400（既にアクション済み）", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as any);
    mockPrisma.questInstance.findUnique.mockResolvedValue({
      id: "q1",
      status: "REPORTED",
      templateId: "tpl-1",
      childId: "child-1",
      template: { carryOver: false },
    } as any);
    mockPrisma.questInstance.findMany.mockResolvedValue([] as any);
    const res = await POST(makeRequest("/api/quests/q1/declare", {}), makeParams("q1"));
    expect(res.status).toBe(400);
    expect(mockPrisma.questDeclaration.upsert).not.toHaveBeenCalled();
  });

  it("週次タスクで先週スキップしただけの場合は 400（missedExposures=2 < 3）", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as any);
    mockPrisma.questInstance.findUnique.mockResolvedValue({
      id: "q-week",
      status: "PENDING",
      templateId: "tpl-week",
      childId: "child-1",
      template: { carryOver: false },
    } as any);
    // 今日(月) PENDING + 先週(月) SKIPPED + 先々週(月) APPROVED
    mockPrisma.questInstance.findMany.mockResolvedValue([
      { date: day("2026-05-11"), status: "PENDING" },
      { date: day("2026-05-04"), status: "SKIPPED" },
      { date: day("2026-04-27"), status: "APPROVED" },
    ] as any);
    const res = await POST(makeRequest("/api/quests/q-week/declare", {}), makeParams("q-week"));
    expect(res.status).toBe(400);
    expect(mockPrisma.questDeclaration.upsert).not.toHaveBeenCalled();
  });

  it("3週連続非APPROVED なら宣言成功（missedExposures=3）", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as any);
    mockPrisma.questInstance.findUnique.mockResolvedValue({
      id: "q-week",
      status: "PENDING",
      templateId: "tpl-week",
      childId: "child-1",
      template: { carryOver: false },
    } as any);
    mockPrisma.questInstance.findMany.mockResolvedValue([
      { date: day("2026-05-11"), status: "PENDING" },
      { date: day("2026-05-04"), status: "SKIPPED" },
      { date: day("2026-04-27"), status: "SKIPPED" },
      { date: day("2026-04-20"), status: "APPROVED" },
    ] as any);
    mockPrisma.questDeclaration.upsert.mockResolvedValue({} as any);

    const res = await POST(makeRequest("/api/quests/q-week/declare", {}), makeParams("q-week"));
    expect(res.status).toBe(200);
    expect(mockPrisma.questDeclaration.upsert).toHaveBeenCalled();
  });

  it("毎日タスクで3日連続非APPROVED なら宣言成功", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as any);
    mockPrisma.questInstance.findUnique.mockResolvedValue({
      id: "q-daily",
      status: "PENDING",
      templateId: "tpl-daily",
      childId: "child-1",
      template: { carryOver: false },
    } as any);
    mockPrisma.questInstance.findMany.mockResolvedValue([
      { date: day("2026-05-09"), status: "PENDING" },
      { date: day("2026-05-08"), status: "PENDING" },
      { date: day("2026-05-07"), status: "PENDING" },
      { date: day("2026-05-06"), status: "APPROVED" },
    ] as any);
    mockPrisma.questDeclaration.upsert.mockResolvedValue({} as any);

    const res = await POST(makeRequest("/api/quests/q-daily/declare", {}), makeParams("q-daily"));
    expect(res.status).toBe(200);
  });

  it("carryOver: instance.date が3日以上前なら宣言成功（暦日基準）", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as any);
    // 今日のシステム時刻を 5/9 に固定
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-09T09:00:00"));

    mockPrisma.questInstance.findUnique.mockResolvedValue({
      id: "q-carry",
      status: "PENDING",
      templateId: "tpl-carry",
      childId: "child-1",
      template: { carryOver: true },
    } as any);
    // carryOver で 5/7 に作成された PENDING が今日まで残っている
    mockPrisma.questInstance.findMany.mockResolvedValue([
      { date: day("2026-05-07"), status: "PENDING" },
      { date: day("2026-05-06"), status: "APPROVED" },
    ] as any);
    mockPrisma.questDeclaration.upsert.mockResolvedValue({} as any);

    const res = await POST(makeRequest("/api/quests/q-carry/declare", {}), makeParams("q-carry"));
    expect(res.status).toBe(200);
    vi.useRealTimers();
  });

  it("REJECTED かつ閾値到達なら宣言可能", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as any);
    mockPrisma.questInstance.findUnique.mockResolvedValue({
      id: "q-rej",
      status: "REJECTED",
      templateId: "tpl-1",
      childId: "child-1",
      template: { carryOver: false },
    } as any);
    mockPrisma.questInstance.findMany.mockResolvedValue([
      { date: day("2026-05-09"), status: "REJECTED" },
      { date: day("2026-05-08"), status: "PENDING" },
      { date: day("2026-05-07"), status: "PENDING" },
    ] as any);
    mockPrisma.questDeclaration.upsert.mockResolvedValue({} as any);
    const res = await POST(makeRequest("/api/quests/q-rej/declare", {}), makeParams("q-rej"));
    expect(res.status).toBe(200);
  });

  it("二重押しでも upsert なので冪等（200）", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as any);
    mockPrisma.questInstance.findUnique.mockResolvedValue({
      id: "q1",
      status: "PENDING",
      templateId: "tpl-1",
      childId: "child-1",
      template: { carryOver: false },
    } as any);
    mockPrisma.questInstance.findMany.mockResolvedValue([
      { date: day("2026-05-09"), status: "PENDING" },
      { date: day("2026-05-08"), status: "PENDING" },
      { date: day("2026-05-07"), status: "PENDING" },
    ] as any);
    mockPrisma.questDeclaration.upsert.mockResolvedValue({} as any);

    const res1 = await POST(makeRequest("/api/quests/q1/declare", {}), makeParams("q1"));
    const res2 = await POST(makeRequest("/api/quests/q1/declare", {}), makeParams("q1"));
    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(mockPrisma.questDeclaration.upsert).toHaveBeenCalledTimes(2);
  });
});
