import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST as fulfillPOST } from "@/app/api/treasures/fulfill/[id]/route";
import { GET as pendingGET } from "@/app/api/treasures/pending/route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { parentUser, childUser } from "../../helpers/fixtures";
import { makeParams } from "../../helpers/request";

const mockPrisma = vi.mocked(prisma);
const mockGetCurrentUser = vi.mocked(getCurrentUser);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/treasures/fulfill/[id]", () => {
  it("CHILDで403", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as any);
    const res = await fulfillPOST(new Request("http://localhost/api/treasures/fulfill/log-1", { method: "POST" }), makeParams("log-1"));
    expect(res.status).toBe(403);
  });

  it("自家族でない宝箱は404", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    mockPrisma.treasureLog.findFirst.mockResolvedValue(null);
    const res = await fulfillPOST(new Request("http://localhost/api/treasures/fulfill/log-1", { method: "POST" }), makeParams("log-1"));
    expect(res.status).toBe(404);
  });

  it("OPENED でない宝箱は400", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    mockPrisma.treasureLog.findFirst.mockResolvedValue({
      id: "log-1",
      status: "UNLOCKED",
      itemId: "i1",
      fulfilled: false,
    } as any);
    const res = await fulfillPOST(new Request("http://localhost/api/treasures/fulfill/log-1", { method: "POST" }), makeParams("log-1"));
    expect(res.status).toBe(400);
  });

  it("ハズレ（itemId null）は400", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    mockPrisma.treasureLog.findFirst.mockResolvedValue({
      id: "log-1",
      status: "OPENED",
      itemId: null,
      fulfilled: false,
    } as any);
    const res = await fulfillPOST(new Request("http://localhost/api/treasures/fulfill/log-1", { method: "POST" }), makeParams("log-1"));
    expect(res.status).toBe(400);
  });

  it("既に fulfilled でも 200 (idempotent)", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    mockPrisma.treasureLog.findFirst.mockResolvedValue({
      id: "log-1",
      status: "OPENED",
      itemId: "i1",
      fulfilled: true,
    } as any);
    const res = await fulfillPOST(new Request("http://localhost/api/treasures/fulfill/log-1", { method: "POST" }), makeParams("log-1"));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.alreadyFulfilled).toBe(true);
    expect(mockPrisma.treasureLog.update).not.toHaveBeenCalled();
  });

  it("正常系: fulfilled=true に更新", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    mockPrisma.treasureLog.findFirst.mockResolvedValue({
      id: "log-1",
      status: "OPENED",
      itemId: "i1",
      fulfilled: false,
    } as any);
    mockPrisma.treasureLog.update.mockResolvedValue({} as any);
    const res = await fulfillPOST(new Request("http://localhost/api/treasures/fulfill/log-1", { method: "POST" }), makeParams("log-1"));
    expect(res.status).toBe(200);
    expect(mockPrisma.treasureLog.update).toHaveBeenCalledWith({
      where: { id: "log-1" },
      data: { fulfilled: true },
    });
  });
});

describe("GET /api/treasures/pending", () => {
  it("CHILDで403", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as any);
    const res = await pendingGET();
    expect(res.status).toBe(403);
  });

  it("familyId なしで空配列", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser({ familyId: null }) as any);
    const res = await pendingGET();
    const json = await res.json();
    expect(json.items).toEqual([]);
  });

  it("OPENED + 未受け渡し + itemId 有のみ取得", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    mockPrisma.treasureLog.findMany.mockResolvedValue([
      {
        id: "log-1",
        openedAt: new Date("2026-03-21"),
        item: { id: "i1", title: "おやつ", rarity: "COMMON" },
        child: { id: "child-1", name: "太郎", monsterName: "ドラゴン" },
      } as any,
    ]);
    const res = await pendingGET();
    const json = await res.json();
    expect(json.items).toHaveLength(1);
    // 条件確認
    const arg = (mockPrisma.treasureLog.findMany as any).mock.calls[0][0];
    expect(arg.where).toMatchObject({
      status: "OPENED",
      fulfilled: false,
      itemId: { not: null },
    });
  });
});
