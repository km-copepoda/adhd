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

  it("自分のクエストでなければ 404（findUnique で childId スコープ）", async () => {
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
      template: { createdAt: new Date("2026-04-01") },
    } as any);
    const res = await POST(makeRequest("/api/quests/q1/declare", {}), makeParams("q1"));
    expect(res.status).toBe(400);
    expect(mockPrisma.questDeclaration.upsert).not.toHaveBeenCalled();
  });

  it("idleDays が 3 未満なら 400（資格なし）", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as any);
    mockPrisma.questInstance.findUnique.mockResolvedValue({
      id: "q1",
      status: "PENDING",
      templateId: "tpl-1",
      childId: "child-1",
      template: { createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) },
    } as any);
    // 直近に APPROVED あり（昨日）= idleDays 1
    mockPrisma.questInstance.findFirst.mockResolvedValue({
      approvedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    } as any);
    const res = await POST(makeRequest("/api/quests/q1/declare", {}), makeParams("q1"));
    expect(res.status).toBe(400);
    expect(mockPrisma.questDeclaration.upsert).not.toHaveBeenCalled();
  });

  it("PENDING かつ idleDays >= 3 なら QuestDeclaration を upsert して 200", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as any);
    mockPrisma.questInstance.findUnique.mockResolvedValue({
      id: "q1",
      status: "PENDING",
      templateId: "tpl-1",
      childId: "child-1",
      template: { createdAt: new Date("2026-01-01") },
    } as any);
    mockPrisma.questInstance.findFirst.mockResolvedValue(null); // 一度もAPPROVEDなし
    mockPrisma.questDeclaration.upsert.mockResolvedValue({} as any);

    const res = await POST(makeRequest("/api/quests/q1/declare", {}), makeParams("q1"));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(mockPrisma.questDeclaration.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          templateId_childId_date: expect.objectContaining({
            templateId: "tpl-1",
            childId: "child-1",
          }),
        }),
        create: expect.objectContaining({
          templateId: "tpl-1",
          childId: "child-1",
        }),
        update: {},
      }),
    );
  });

  it("REJECTED かつ idleDays >= 3 でも宣言可能", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as any);
    mockPrisma.questInstance.findUnique.mockResolvedValue({
      id: "q-rej",
      status: "REJECTED",
      templateId: "tpl-1",
      childId: "child-1",
      template: { createdAt: new Date("2026-01-01") },
    } as any);
    mockPrisma.questInstance.findFirst.mockResolvedValue(null);
    mockPrisma.questDeclaration.upsert.mockResolvedValue({} as any);
    const res = await POST(makeRequest("/api/quests/q-rej/declare", {}), makeParams("q-rej"));
    expect(res.status).toBe(200);
    expect(mockPrisma.questDeclaration.upsert).toHaveBeenCalled();
  });

  it("二重押しでも upsert なので冪等（200）", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as any);
    mockPrisma.questInstance.findUnique.mockResolvedValue({
      id: "q1",
      status: "PENDING",
      templateId: "tpl-1",
      childId: "child-1",
      template: { createdAt: new Date("2026-01-01") },
    } as any);
    mockPrisma.questInstance.findFirst.mockResolvedValue(null);
    mockPrisma.questDeclaration.upsert.mockResolvedValue({} as any);

    const res1 = await POST(makeRequest("/api/quests/q1/declare", {}), makeParams("q1"));
    const res2 = await POST(makeRequest("/api/quests/q1/declare", {}), makeParams("q1"));
    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(mockPrisma.questDeclaration.upsert).toHaveBeenCalledTimes(2);
  });
});
