import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  generateTreasuresOnReport,
  generateProxyTreasure,
  openOldestTreasure,
} from "@/lib/treasureService";
import { triggerCollectionItemLog } from "@/lib/bulletinLog";
import { prismaMock as mockPrisma } from "../helpers/prisma-mock";
import { treasureLog, treasureItem, childUser, userCollectionItem } from "../helpers/fixtures";

vi.mock("@/lib/bulletinLog", () => ({
  triggerCollectionItemLog: vi.fn(),
}));

const mockTriggerCollectionLog = vi.mocked(triggerCollectionItemLog);

function poolRow() {
  return treasureItem({ id: "item-1", title: "おやつ", rarity: "COMMON" });
}

const dateJST = new Date(Date.UTC(2026, 4, 27));

beforeEach(() => {
  vi.clearAllMocks();
});

// Issue #187: 開封・生成のアトミック性
describe("openOldestTreasure — 同時開封の二重付与防止 (#187)", () => {
  beforeEach(() => {
    mockPrisma.user.findUnique.mockResolvedValue(childUser({ treasurePityCount: 0, familyId: null }));
    mockPrisma.user.update.mockResolvedValue(childUser());
    mockPrisma.treasureLog.update.mockResolvedValue(treasureLog());
    mockPrisma.userCollectionItem.upsert.mockResolvedValue(userCollectionItem({ count: 1 }));
    mockPrisma.treasureItem.findMany.mockResolvedValue([]);
  });

  it("status=UNLOCKED 条件付き updateMany で先に占有してから抽選する", async () => {
    mockPrisma.treasureLog.findFirst.mockResolvedValue(treasureLog({ id: "log-claim", childId: "c1" }));
    mockPrisma.treasureLog.updateMany.mockResolvedValue({ count: 1 });
    const now = new Date("2026-07-15T03:00:00Z");

    await openOldestTreasure("c1", { now });

    expect(mockPrisma.treasureLog.updateMany).toHaveBeenCalledWith({
      where: { id: "log-claim", status: "UNLOCKED" },
      data: { status: "OPENED", openedAt: now },
    });
  });

  it("占有に負けた (count=0) 場合は null を返し、付与・ログ・pity 更新を一切行わない", async () => {
    mockPrisma.treasureLog.findFirst.mockResolvedValue(treasureLog({ id: "log-race", childId: "c1" }));
    mockPrisma.treasureLog.updateMany.mockResolvedValue({ count: 0 });

    const result = await openOldestTreasure("c1", { now: new Date("2026-07-15T03:00:00Z") });

    expect(result).toBeNull();
    expect(mockPrisma.userCollectionItem.upsert).not.toHaveBeenCalled();
    expect(mockTriggerCollectionLog).not.toHaveBeenCalled();
    expect(mockPrisma.treasureLog.update).not.toHaveBeenCalled();
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("同じ宝箱への 2 回の同時開封: 付与・ログは 1 回だけで 2 回目は null", async () => {
    mockPrisma.treasureLog.findFirst.mockResolvedValue(treasureLog({ id: "log-dup", childId: "c1" }));
    mockPrisma.treasureLog.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    const now = new Date("2026-07-15T03:00:00Z");

    const [a, b] = await Promise.all([
      openOldestTreasure("c1", { now }),
      openOldestTreasure("c1", { now }),
    ]);

    expect([a, b].filter((r) => r !== null)).toHaveLength(1);
    expect([a, b].filter((r) => r === null)).toHaveLength(1);
    expect(mockPrisma.userCollectionItem.upsert).toHaveBeenCalledTimes(1);
    expect(mockTriggerCollectionLog).toHaveBeenCalledTimes(1);
    expect(mockPrisma.treasureLog.update).toHaveBeenCalledTimes(1);
  });

  it("UNLOCKED が 0 件なら占有を試みず null", async () => {
    mockPrisma.treasureLog.findFirst.mockResolvedValue(null);
    expect(await openOldestTreasure("c1")).toBeNull();
    expect(mockPrisma.treasureLog.updateMany).not.toHaveBeenCalled();
  });

  it("pity=9 の MISS rng でも 10 回目は強制 HIT し pity を 0 に戻す", async () => {
    mockPrisma.treasureLog.findFirst.mockResolvedValue(treasureLog({ id: "log-pity", childId: "c1" }));
    mockPrisma.treasureLog.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.treasureItem.findMany.mockResolvedValue([poolRow()]);
    mockPrisma.user.findUnique.mockResolvedValue(childUser({ treasurePityCount: 9, familyId: null }));

    const result = await openOldestTreasure("c1", { rng: () => 0.99 });

    expect(result!.item?.id).toBe("item-1");
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { treasurePityCount: 0 },
    });
  });

  it("pity=8 の MISS は 9 になるだけで強制 HIT しない (境界)", async () => {
    mockPrisma.treasureLog.findFirst.mockResolvedValue(treasureLog({ id: "log-pity8", childId: "c1" }));
    mockPrisma.treasureLog.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.treasureItem.findMany.mockResolvedValue([poolRow()]);
    mockPrisma.user.findUnique.mockResolvedValue(childUser({ treasurePityCount: 8, familyId: null }));

    const result = await openOldestTreasure("c1", {
      rng: () => 0.99,
      now: new Date("2026-07-15T03:00:00Z"),
    });

    expect(result!.item).toBeNull();
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { treasurePityCount: 9 },
    });
  });

  it("占有・付与・ログ更新は同一トランザクション内で行う", async () => {
    mockPrisma.treasureLog.findFirst.mockResolvedValue(treasureLog({ id: "log-tx", childId: "c1" }));
    mockPrisma.treasureLog.updateMany.mockResolvedValue({ count: 1 });

    await openOldestTreasure("c1", { now: new Date("2026-07-15T03:00:00Z") });

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });
});

describe("宝箱生成の冪等性 — P2002 (部分ユニーク違反) の握りつぶし (#187)", () => {
  const p2002 = () => Object.assign(new Error("Unique constraint failed"), { code: "P2002" });

  it("generateTreasuresOnReport: create が P2002 でも例外にならず、作成済み ID に含めない", async () => {
    mockPrisma.treasureLog.findMany.mockResolvedValue([]);
    mockPrisma.treasureLog.create.mockRejectedValue(p2002());

    const ids = await generateTreasuresOnReport({
      childId: "c1", date: dateJST, reportedCount: 3, totalCount: 5,
      skippedCount: 0, minTasks: 3, isProxy: false,
    });

    expect(ids).toEqual([]);
  });

  it("generateTreasuresOnReport: STREAK が P2002 でも ALL_COMPLETE の作成は続行する", async () => {
    mockPrisma.treasureLog.findMany.mockResolvedValue([]);
    mockPrisma.treasureLog.create
      .mockRejectedValueOnce(p2002())
      .mockResolvedValueOnce(treasureLog({ id: "t-all" }));

    const ids = await generateTreasuresOnReport({
      childId: "c1", date: dateJST, reportedCount: 5, totalCount: 5,
      skippedCount: 0, minTasks: 3, isProxy: false,
    });

    expect(ids).toEqual(["t-all"]);
  });

  it("generateTreasuresOnReport: P2002 以外のエラーは握りつぶさず投げる", async () => {
    mockPrisma.treasureLog.findMany.mockResolvedValue([]);
    mockPrisma.treasureLog.create.mockRejectedValue(new Error("db down"));

    await expect(
      generateTreasuresOnReport({
        childId: "c1", date: dateJST, reportedCount: 3, totalCount: 5,
        skippedCount: 0, minTasks: 3, isProxy: false,
      }),
    ).rejects.toThrow("db down");
  });

  it("generateProxyTreasure: create が P2002 でも例外にならず空配列", async () => {
    mockPrisma.treasureLog.findMany.mockResolvedValue([]);
    mockPrisma.treasureLog.create.mockRejectedValue(p2002());

    const ids = await generateProxyTreasure({
      childId: "c1", date: dateJST, reportedCount: 3, totalCount: 5,
      skippedCount: 0, minTasks: 3,
    });

    expect(ids).toEqual([]);
  });

  it("generateProxyTreasure: P2002 以外のエラーは投げる", async () => {
    mockPrisma.treasureLog.findMany.mockResolvedValue([]);
    mockPrisma.treasureLog.create.mockRejectedValue(new Error("boom"));

    await expect(
      generateProxyTreasure({
        childId: "c1", date: dateJST, reportedCount: 3, totalCount: 5,
        skippedCount: 0, minTasks: 3,
      }),
    ).rejects.toThrow("boom");
  });
});
