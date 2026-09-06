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

  // #127 follow-up: ごほうび在庫（rewards）は開封履歴の 50 件上限とは独立に、
  // 保持期間内は全件取得する（take を掛けない）。上限に相乗り／別上限を掛けると
  // 溜め込み開封で期間内の未使用ごほうびが一覧から欠落しトグル不能になる。
  it("rewards をコレクション当選除外・上限なし（保持期間で頭打ち）で返す", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    mockPrisma.treasureLog.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0);

    const history: OpenedTreasureLog[] = [
      {
        ...treasureLog({
          id: "col-1",
          openedAt: new Date("2026-03-21"),
          status: "OPENED",
          itemId: null,
        }),
        item: null,
      },
    ];
    const rewardInventory: OpenedTreasureLog[] = [
      {
        ...treasureLog({
          id: "rw-1",
          openedAt: new Date("2026-03-10"),
          status: "OPENED",
          itemId: "i1",
          fulfilled: false,
        }),
        item: { id: "i1", title: "おかし", rarity: "COMMON" },
      },
    ];
    mockPrisma.treasureLog.findMany
      .mockResolvedValueOnce(history)
      .mockResolvedValueOnce(rewardInventory);
    mockPrisma.treasureItem.count.mockResolvedValue(0);

    const res = await GET();
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.rewards).toHaveLength(1);
    expect(json.rewards[0].id).toBe("rw-1");
    expect(json.rewards[0].fulfilled).toBe(false);
    expect(json.rewards[0].item.title).toBe("おかし");

    const rewardQuery = mockPrisma.treasureLog.findMany.mock.calls[1]?.[0] as {
      where: { itemId?: unknown; openedAt?: unknown };
      take?: number;
    };
    expect(rewardQuery.where.itemId).toEqual({ not: null });
    // 保持期間フィルタで頭打ちにするため take は掛けない
    expect(rewardQuery.take).toBeUndefined();
    expect(rewardQuery.where.openedAt).toBeDefined();
  });
});
