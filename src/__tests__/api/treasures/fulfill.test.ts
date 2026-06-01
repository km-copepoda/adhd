import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/treasures/fulfill/[id]/route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { childUser, parentUser } from "../../helpers/fixtures";
import { makeParams, makeRequest } from "../../helpers/request";

const mockPrisma = vi.mocked(prisma);
const mockGetCurrentUser = vi.mocked(getCurrentUser);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/treasures/fulfill/[id]", () => {
  it("未認証で 401", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await POST(
      makeRequest("/api/treasures/fulfill/t1", { fulfilled: true }),
      makeParams("t1"),
    );
    expect(res.status).toBe(401);
  });

  it("CHILD ロールで 403 (親のみ操作可)", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as any);
    const res = await POST(
      makeRequest("/api/treasures/fulfill/t1", { fulfilled: true }),
      makeParams("t1"),
    );
    expect(res.status).toBe(403);
  });

  it("対象 TreasureLog が無ければ 404", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    mockPrisma.treasureLog.findFirst.mockResolvedValue(null);
    const res = await POST(
      makeRequest("/api/treasures/fulfill/t-missing", { fulfilled: true }),
      makeParams("t-missing"),
    );
    expect(res.status).toBe(404);
  });

  it("別 family の TreasureLog で 404 (familyId スコープ)", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser({ familyId: "fam-1" }) as any);
    mockPrisma.treasureLog.findFirst.mockResolvedValue(null);
    const res = await POST(
      makeRequest("/api/treasures/fulfill/t1", { fulfilled: true }),
      makeParams("t1"),
    );
    expect(res.status).toBe(404);
    // findFirst の where に familyId スコープが入っていることを確認
    const callArg = (mockPrisma.treasureLog.findFirst as any).mock.calls[0][0];
    expect(callArg.where.child.familyId).toBe("fam-1");
  });

  it("親ごほうび当選 (item not null) を fulfilled=true で更新", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser({ familyId: "fam-1" }) as any);
    mockPrisma.treasureLog.findFirst.mockResolvedValue({
      id: "t1",
      itemId: "item-1",
      fulfilled: false,
    } as any);
    mockPrisma.treasureLog.update.mockResolvedValue({ id: "t1", fulfilled: true } as any);

    const res = await POST(
      makeRequest("/api/treasures/fulfill/t1", { fulfilled: true }),
      makeParams("t1"),
    );
    expect(res.status).toBe(200);
    expect(mockPrisma.treasureLog.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "t1" },
        data: { fulfilled: true },
      }),
    );
    const json = await res.json();
    expect(json.fulfilled).toBe(true);
  });

  it("fulfilled=false で取り消し可能 (誤チェック復旧用)", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser({ familyId: "fam-1" }) as any);
    mockPrisma.treasureLog.findFirst.mockResolvedValue({
      id: "t1",
      itemId: "item-1",
      fulfilled: true,
    } as any);
    mockPrisma.treasureLog.update.mockResolvedValue({ id: "t1", fulfilled: false } as any);

    const res = await POST(
      makeRequest("/api/treasures/fulfill/t1", { fulfilled: false }),
      makeParams("t1"),
    );
    expect(res.status).toBe(200);
    expect(mockPrisma.treasureLog.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "t1" },
        data: { fulfilled: false },
      }),
    );
  });

  it("コレクション獲得 (itemId=null) は 400 (実物受け渡しが無いので fulfilled の意味なし)", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser({ familyId: "fam-1" }) as any);
    mockPrisma.treasureLog.findFirst.mockResolvedValue({
      id: "t-col",
      itemId: null,
      collectionItemId: "summer-01",
      fulfilled: false,
    } as any);

    const res = await POST(
      makeRequest("/api/treasures/fulfill/t-col", { fulfilled: true }),
      makeParams("t-col"),
    );
    expect(res.status).toBe(400);
    expect(mockPrisma.treasureLog.update).not.toHaveBeenCalled();
  });

  it("body.fulfilled が boolean でなければ 400", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser({ familyId: "fam-1" }) as any);
    const res = await POST(
      makeRequest("/api/treasures/fulfill/t1", { fulfilled: "yes" } as any),
      makeParams("t1"),
    );
    expect(res.status).toBe(400);
  });
});
