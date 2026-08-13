import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  awardCollectionItem,
  getOwnedCollection,
} from "@/lib/collectionService";
import { prismaMock as mockPrisma } from "../helpers/prisma-mock";
import { userCollectionItem } from "../helpers/fixtures";

beforeEach(() => {
  vi.clearAllMocks();
});

const FIXED_NOW = new Date("2026-06-15T03:00:00Z");

describe("awardCollectionItem", () => {
  it("初獲得 → upsert で count=1 / firstAcquiredAt=now / lastAcquiredAt=now", async () => {
    mockPrisma.userCollectionItem.upsert.mockResolvedValue(
      userCollectionItem({
        id: "rec-1",
        childId: "c1",
        itemId: "summer-01",
        season: "summer",
        count: 1,
        firstAcquiredAt: FIXED_NOW,
        lastAcquiredAt: FIXED_NOW,
      }),
    );

    const rec = await awardCollectionItem("c1", "summer-01", "summer", FIXED_NOW);

    expect(rec.count).toBe(1);
    expect(mockPrisma.userCollectionItem.upsert).toHaveBeenCalledWith({
      where: { childId_itemId: { childId: "c1", itemId: "summer-01" } },
      create: {
        childId: "c1",
        itemId: "summer-01",
        season: "summer",
        count: 1,
        firstAcquiredAt: FIXED_NOW,
        lastAcquiredAt: FIXED_NOW,
      },
      update: {
        count: { increment: 1 },
        lastAcquiredAt: FIXED_NOW,
      },
    });
  });

  it("ダブり獲得 → update で count increment と lastAcquiredAt 更新", async () => {
    mockPrisma.userCollectionItem.upsert.mockResolvedValue(
      userCollectionItem({
        id: "rec-1",
        childId: "c1",
        itemId: "summer-01",
        season: "summer",
        count: 2,
        firstAcquiredAt: new Date("2026-06-01T00:00:00Z"),
        lastAcquiredAt: FIXED_NOW,
      }),
    );

    const rec = await awardCollectionItem("c1", "summer-01", "summer", FIXED_NOW);
    expect(rec.count).toBe(2);
  });
});

describe("getOwnedCollection", () => {
  it("子供の所持コレクションを取得 (childId フィルタ)", async () => {
    mockPrisma.userCollectionItem.findMany.mockResolvedValue([
      userCollectionItem({ id: "r1", childId: "c1", itemId: "summer-01", season: "summer", count: 2, firstAcquiredAt: FIXED_NOW, lastAcquiredAt: FIXED_NOW }),
      userCollectionItem({ id: "r2", childId: "c1", itemId: "summer-05", season: "summer", count: 1, firstAcquiredAt: FIXED_NOW, lastAcquiredAt: FIXED_NOW }),
    ]);

    const list = await getOwnedCollection("c1");
    expect(list).toHaveLength(2);
    expect(mockPrisma.userCollectionItem.findMany).toHaveBeenCalledWith({
      where: { childId: "c1" },
      orderBy: { lastAcquiredAt: "desc" },
    });
  });

  it("所持なしなら空配列", async () => {
    mockPrisma.userCollectionItem.findMany.mockResolvedValue([]);
    const list = await getOwnedCollection("c1");
    expect(list).toEqual([]);
  });
});
