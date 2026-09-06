import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Prisma } from "@/generated/prisma/client";
import { GET } from "@/app/api/treasures/status/route";
import { getCurrentUser } from "@/lib/auth";
import { prismaMock as mockPrisma } from "../../helpers/prisma-mock";
import { childUserWithFamily, parentUserWithFamily, treasureLog } from "../../helpers/fixtures";

const mockGetCurrentUser = vi.mocked(getCurrentUser);

type OpenedTreasureLog = Prisma.TreasureLogGetPayload<{
  include: { item: { select: { id: true; title: true; rarity: true } } };
}>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/treasures/status", () => {
  it("PARENTで403", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("LOCKED/UNLOCKED 件数と OPENED 履歴を返す", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    mockPrisma.treasureLog.count
      .mockResolvedValueOnce(2) // LOCKED
      .mockResolvedValueOnce(3); // UNLOCKED
    const opened: OpenedTreasureLog[] = [
      {
        ...treasureLog({
          id: "log-1",
          openedAt: new Date("2026-03-21"),
          boosted: false,
          status: "OPENED",
          itemId: "i1",
          fulfilled: true,
        }),
        item: { id: "i1", title: "おやつ", rarity: "COMMON" },
      },
      {
        ...treasureLog({
          id: "log-2",
          openedAt: new Date("2026-03-20"),
          boosted: true,
          status: "OPENED",
          itemId: null,
        }),
        item: null, // 親ごほうび不当選 (コレクションアイテム獲得)
      },
    ];
    mockPrisma.treasureLog.findMany.mockResolvedValue(opened);
    mockPrisma.treasureItem.count.mockResolvedValue(0);

    const res = await GET();
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.locked).toBe(2);
    expect(json.unlocked).toBe(3);
    expect(json.opened).toHaveLength(2);
    expect(json.opened[0].item.title).toBe("おやつ");
    expect(json.opened[1].item).toBeNull();
  });

  // #72: 子向けレスポンスにも使用状態（fulfilled 相当）を露出する。
  // フィールド名は実装判断のため fulfilled / used のどちらでも通る形で検証する。
  it("opened[] の itemId != null 行に使用済み状態を含める", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    mockPrisma.treasureLog.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
    const opened: OpenedTreasureLog[] = [
      {
        ...treasureLog({
          id: "log-used",
          openedAt: new Date("2026-03-21"),
          status: "OPENED",
          itemId: "i1",
          fulfilled: true,
        }),
        item: { id: "i1", title: "おやつ", rarity: "COMMON" },
      },
      {
        ...treasureLog({
          id: "log-col",
          openedAt: new Date("2026-03-20"),
          status: "OPENED",
          itemId: null,
        }),
        item: null,
      },
    ];
    mockPrisma.treasureLog.findMany.mockResolvedValue(opened);
    mockPrisma.treasureItem.count.mockResolvedValue(0);

    const res = await GET();
    const json = await res.json();
    const usedFlag = json.opened[0].fulfilled ?? json.opened[0].used;
    expect(usedFlag).toBe(true);
    // コレクション当選（itemId=null）には使用済みの概念が無い（含めない or false 固定）
    const colFlag = json.opened[1].fulfilled ?? json.opened[1].used ?? false;
    expect(colFlag).toBe(false);
  });
});
