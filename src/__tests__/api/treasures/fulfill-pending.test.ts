import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET as pendingGET } from "@/app/api/treasures/pending/route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { parentUser, childUser } from "../../helpers/fixtures";

const mockPrisma = vi.mocked(prisma);
const mockGetCurrentUser = vi.mocked(getCurrentUser);

beforeEach(() => {
  vi.clearAllMocks();
});

// 「渡したよ」フローは廃止 (2026-05-28 B 決定)。
// /api/treasures/pending は「親が把握する子供の当たり履歴」として残し、
// fulfilled フィルタは外して時系列順で返す。
describe("GET /api/treasures/pending (もらったごほうび履歴)", () => {
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

  it("OPENED + itemId 有 を fulfilled の値に関係なく取得", async () => {
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
    const arg = (mockPrisma.treasureLog.findMany as any).mock.calls[0][0];
    // 「渡したよ」廃止: fulfilled フィルタは入らない
    expect(arg.where).not.toHaveProperty("fulfilled");
    // 当たりのみ取得（ハズレは履歴に出さない）
    expect(arg.where).toMatchObject({
      status: "OPENED",
      itemId: { not: null },
    });
  });

  it("openedAt の新しい順で並ぶ", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    mockPrisma.treasureLog.findMany.mockResolvedValue([]);
    await pendingGET();
    const arg = (mockPrisma.treasureLog.findMany as any).mock.calls[0][0];
    expect(arg.orderBy).toMatchObject({ openedAt: "desc" });
  });

  it("最大100件まで取得（履歴は無制限に出さない）", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    mockPrisma.treasureLog.findMany.mockResolvedValue([]);
    await pendingGET();
    const arg = (mockPrisma.treasureLog.findMany as any).mock.calls[0][0];
    expect(arg.take).toBe(100);
  });
});
