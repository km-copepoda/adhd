import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  generateTreasuresOnReport,
  unlockTreasuresOnApprove,
  cancelTreasuresOnReject,
  generateProxyTreasure,
  openOldestTreasure,
} from "@/lib/treasureService";

const mockPrisma = vi.mocked(prisma);

beforeEach(() => {
  vi.clearAllMocks();
});

const dateJST = new Date(Date.UTC(2026, 4, 27)); // 2026-05-27 JST

// ─── generateTreasuresOnReport ──────────────────────────────────────────────
describe("generateTreasuresOnReport", () => {
  beforeEach(() => {
    // 既定: プールに 1 件あるので生成は進む
    mockPrisma.treasureItem.count.mockResolvedValue(1);
  });

  it("プールが空 (treasureItem.count=0) なら何もしない", async () => {
    mockPrisma.treasureItem.count.mockResolvedValue(0);
    const ids = await generateTreasuresOnReport({
      childId: "c1",
      date: dateJST,
      reportedCount: 3,
      totalCount: 3,
      minTasks: 1,
      isProxy: false,
    });
    expect(ids).toEqual([]);
    expect(mockPrisma.treasureLog.create).not.toHaveBeenCalled();
    expect(mockPrisma.treasureLog.findMany).not.toHaveBeenCalled();
  });

  it("isProxy=true なら何もしない (親代理は宝箱対象外)", async () => {
    const ids = await generateTreasuresOnReport({
      childId: "c1",
      date: dateJST,
      reportedCount: 5,
      totalCount: 5,
      minTasks: 1,
      isProxy: true,
    });
    expect(ids).toEqual([]);
    expect(mockPrisma.treasureLog.create).not.toHaveBeenCalled();
  });

  it("minTasks 未達なら何もしない", async () => {
    mockPrisma.treasureLog.findMany.mockResolvedValue([]);
    const ids = await generateTreasuresOnReport({
      childId: "c1",
      date: dateJST,
      reportedCount: 0,
      totalCount: 3,
      minTasks: 1,
      isProxy: false,
    });
    expect(ids).toEqual([]);
    expect(mockPrisma.treasureLog.create).not.toHaveBeenCalled();
  });

  it("minTasks 達成・全完了でない → STREAK LOCKED 1個", async () => {
    mockPrisma.treasureLog.findMany.mockResolvedValue([]);
    mockPrisma.treasureLog.create.mockResolvedValue({ id: "t1" } as any);

    const ids = await generateTreasuresOnReport({
      childId: "c1",
      date: dateJST,
      reportedCount: 1,
      totalCount: 3,
      minTasks: 1,
      isProxy: false,
    });
    expect(ids).toEqual(["t1"]);
    expect(mockPrisma.treasureLog.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.treasureLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        childId: "c1",
        date: dateJST,
        trigger: "STREAK",
        boosted: false,
        status: "LOCKED",
      }),
    });
  });

  it("全完了 → STREAK + ALL_COMPLETE(boosted) の LOCKED 2個", async () => {
    mockPrisma.treasureLog.findMany.mockResolvedValue([]);
    mockPrisma.treasureLog.create
      .mockResolvedValueOnce({ id: "t-streak" } as any)
      .mockResolvedValueOnce({ id: "t-all" } as any);

    const ids = await generateTreasuresOnReport({
      childId: "c1",
      date: dateJST,
      reportedCount: 3,
      totalCount: 3,
      minTasks: 1,
      isProxy: false,
    });

    expect(ids).toEqual(["t-streak", "t-all"]);
    expect(mockPrisma.treasureLog.create).toHaveBeenCalledTimes(2);
    const calls = mockPrisma.treasureLog.create.mock.calls;
    expect(calls[0][0].data).toEqual(
      expect.objectContaining({ trigger: "STREAK", boosted: false, status: "LOCKED" }),
    );
    expect(calls[1][0].data).toEqual(
      expect.objectContaining({ trigger: "ALL_COMPLETE", boosted: true, status: "LOCKED" }),
    );
  });

  it("既存 STREAK がある日に再報告しても重複生成しない", async () => {
    mockPrisma.treasureLog.findMany.mockResolvedValue([
      { id: "existing", trigger: "STREAK" } as any,
    ]);
    mockPrisma.treasureLog.create.mockResolvedValue({ id: "t-all" } as any);

    const ids = await generateTreasuresOnReport({
      childId: "c1",
      date: dateJST,
      reportedCount: 3,
      totalCount: 3,
      minTasks: 1,
      isProxy: false,
    });
    // 既存 STREAK は飛ばし、ALL_COMPLETE のみ作る
    expect(ids).toEqual(["t-all"]);
    expect(mockPrisma.treasureLog.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.treasureLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ trigger: "ALL_COMPLETE" }),
    });
  });

  it("既存 STREAK + ALL_COMPLETE があれば何も作らない (完全冪等)", async () => {
    mockPrisma.treasureLog.findMany.mockResolvedValue([
      { id: "e1", trigger: "STREAK" } as any,
      { id: "e2", trigger: "ALL_COMPLETE" } as any,
    ]);
    const ids = await generateTreasuresOnReport({
      childId: "c1",
      date: dateJST,
      reportedCount: 3,
      totalCount: 3,
      minTasks: 1,
      isProxy: false,
    });
    expect(ids).toEqual([]);
    expect(mockPrisma.treasureLog.create).not.toHaveBeenCalled();
  });
});

// ─── unlockTreasuresOnApprove ───────────────────────────────────────────────
describe("unlockTreasuresOnApprove", () => {
  it("同日 LOCKED を UNLOCKED に updateMany", async () => {
    mockPrisma.treasureLog.updateMany.mockResolvedValue({ count: 2 } as any);
    const n = await unlockTreasuresOnApprove("c1", dateJST);
    expect(n).toBe(2);
    expect(mockPrisma.treasureLog.updateMany).toHaveBeenCalledWith({
      where: { childId: "c1", date: dateJST, status: "LOCKED" },
      data: { status: "UNLOCKED" },
    });
  });
});

// ─── cancelTreasuresOnReject ────────────────────────────────────────────────
describe("cancelTreasuresOnReject", () => {
  it("差し戻し後 reportedCount < minTasks → 同日 LOCKED 全部 CANCELLED", async () => {
    mockPrisma.treasureLog.updateMany.mockResolvedValue({ count: 2 } as any);
    const n = await cancelTreasuresOnReject({
      childId: "c1",
      date: dateJST,
      reportedCount: 0,
      totalCount: 3,
      minTasks: 1,
      isProxy: false,
    });
    expect(n).toBe(2);
    expect(mockPrisma.treasureLog.updateMany).toHaveBeenCalledWith({
      where: { childId: "c1", date: dateJST, status: "LOCKED" },
      data: { status: "CANCELLED" },
    });
  });

  it("minTasks は満たすが全完了でなくなった → ALL_COMPLETE のみ CANCELLED", async () => {
    mockPrisma.treasureLog.updateMany.mockResolvedValue({ count: 1 } as any);
    const n = await cancelTreasuresOnReject({
      childId: "c1",
      date: dateJST,
      reportedCount: 2,
      totalCount: 3,
      minTasks: 1,
      isProxy: false,
    });
    expect(n).toBe(1);
    expect(mockPrisma.treasureLog.updateMany).toHaveBeenCalledWith({
      where: {
        childId: "c1",
        date: dateJST,
        status: "LOCKED",
        trigger: "ALL_COMPLETE",
      },
      data: { status: "CANCELLED" },
    });
  });

  it("差し戻し後も条件を満たしているなら何もしない", async () => {
    const n = await cancelTreasuresOnReject({
      childId: "c1",
      date: dateJST,
      reportedCount: 3,
      totalCount: 3,
      minTasks: 1,
      isProxy: false,
    });
    expect(n).toBe(0);
    expect(mockPrisma.treasureLog.updateMany).not.toHaveBeenCalled();
  });
});

// ─── generateProxyTreasure ────────────────────────────────────────────
describe("generateProxyTreasure", () => {
  beforeEach(() => {
    mockPrisma.treasureItem.count.mockResolvedValue(1);
  });

  it("プールが空なら null（生成しない）", async () => {
    mockPrisma.treasureItem.count.mockResolvedValue(0);
    const id = await generateProxyTreasure({
      childId: "c1",
      date: dateJST,
      reportedCount: 3,
      totalCount: 3,
      minTasks: 1,
    });
    expect(id).toBeNull();
    expect(mockPrisma.treasureLog.create).not.toHaveBeenCalled();
  });

  it("minTasks 未達なら null", async () => {
    const id = await generateProxyTreasure({
      childId: "c1",
      date: dateJST,
      reportedCount: 0,
      totalCount: 3,
      minTasks: 1,
    });
    expect(id).toBeNull();
    expect(mockPrisma.treasureLog.create).not.toHaveBeenCalled();
  });

  it("条件を満たす → trigger=AUTO, status=UNLOCKED で1個だけ生成", async () => {
    mockPrisma.treasureLog.findFirst.mockResolvedValue(null);
    mockPrisma.treasureLog.create.mockResolvedValue({ id: "ta" } as any);
    const id = await generateProxyTreasure({
      childId: "c1",
      date: dateJST,
      reportedCount: 3,
      totalCount: 3,
      minTasks: 1,
    });
    expect(id).toBe("ta");
    expect(mockPrisma.treasureLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        childId: "c1",
        date: dateJST,
        trigger: "PROXY",
        boosted: false,
        status: "UNLOCKED",
      }),
    });
  });

  it("当日既に AUTO 宝箱があれば作らない (冪等)", async () => {
    mockPrisma.treasureLog.findFirst.mockResolvedValue({ id: "existing" } as any);
    const id = await generateProxyTreasure({
      childId: "c1",
      date: dateJST,
      reportedCount: 3,
      totalCount: 3,
      minTasks: 1,
    });
    expect(id).toBeNull();
    expect(mockPrisma.treasureLog.create).not.toHaveBeenCalled();
  });
});

// ─── openOldestTreasure ─────────────────────────────────────────────────────
describe("openOldestTreasure", () => {
  it("UNLOCKED 宝箱が無いとき null", async () => {
    mockPrisma.treasureLog.findFirst.mockResolvedValue(null);
    const result = await openOldestTreasure("c1");
    expect(result).toBeNull();
  });

  it("最古の UNLOCKED を取得し抽選してアイテム確定 (当たり時 pity リセット)", async () => {
    mockPrisma.treasureLog.findFirst.mockResolvedValue({
      id: "log-1",
      childId: "c1",
      boosted: false,
    } as any);
    // pity=2 から始め、当たりで 0 にリセットされることを検証
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "c1",
      treasurePityCount: 2,
    } as any);
    mockPrisma.treasureItem.findMany.mockResolvedValue([
      { id: "item-1", title: "おやつ", rarity: "COMMON", isActive: true } as any,
    ]);
    mockPrisma.treasureLog.update.mockResolvedValue({} as any);
    mockPrisma.user.update.mockResolvedValue({} as any);

    const result = await openOldestTreasure("c1", { rng: () => 0.0 });

    expect(result).not.toBeNull();
    expect(result!.logId).toBe("log-1");
    expect(result!.item?.id).toBe("item-1");
    expect(result!.miss).toBe(false);
    expect(mockPrisma.treasureLog.update).toHaveBeenCalledWith({
      where: { id: "log-1" },
      data: expect.objectContaining({
        status: "OPENED",
        itemId: "item-1",
        openedAt: expect.any(Date),
      }),
    });
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { treasurePityCount: 0 },
    });
  });

  it("pity に変化が無いケース (初回 0 → 当たりで 0 のまま) は user.update を呼ばない", async () => {
    mockPrisma.treasureLog.findFirst.mockResolvedValue({
      id: "log-1b",
      childId: "c1",
      boosted: false,
    } as any);
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "c1",
      treasurePityCount: 0,
    } as any);
    mockPrisma.treasureItem.findMany.mockResolvedValue([
      { id: "item-1", title: "おやつ", rarity: "COMMON", isActive: true } as any,
    ]);
    mockPrisma.treasureLog.update.mockResolvedValue({} as any);

    const result = await openOldestTreasure("c1", { rng: () => 0.0 });
    expect(result!.miss).toBe(false);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("プールが空ならハズレ扱い (item=null, pityCount は据え置き)", async () => {
    mockPrisma.treasureLog.findFirst.mockResolvedValue({
      id: "log-2",
      childId: "c1",
      boosted: false,
    } as any);
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "c1",
      treasurePityCount: 3,
    } as any);
    mockPrisma.treasureItem.findMany.mockResolvedValue([]);
    mockPrisma.treasureLog.update.mockResolvedValue({} as any);

    const result = await openOldestTreasure("c1");
    expect(result).not.toBeNull();
    expect(result!.item).toBeNull();
    expect(result!.miss).toBe(true);
    expect(mockPrisma.treasureLog.update).toHaveBeenCalledWith({
      where: { id: "log-2" },
      data: expect.objectContaining({ status: "OPENED", itemId: null }),
    });
    // プール空のときは pity を進めない (treasure.ts の仕様)
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("ハズレ時 (プール有・全 MISS) は pityCount を +1", async () => {
    mockPrisma.treasureLog.findFirst.mockResolvedValue({
      id: "log-3",
      childId: "c1",
      boosted: false,
    } as any);
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "c1",
      treasurePityCount: 0,
    } as any);
    mockPrisma.treasureItem.findMany.mockResolvedValue([
      { id: "item-1", title: "おやつ", rarity: "COMMON", isActive: true } as any,
    ]);
    mockPrisma.treasureLog.update.mockResolvedValue({} as any);
    mockPrisma.user.update.mockResolvedValue({} as any);

    const result = await openOldestTreasure("c1", { rng: () => 0.99 }); // ハズレ確定

    expect(result!.item).toBeNull();
    expect(result!.miss).toBe(true);
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { treasurePityCount: 1 },
    });
  });

  it("boosted ログは抽選オプションに boosted=true を渡す", async () => {
    mockPrisma.treasureLog.findFirst.mockResolvedValue({
      id: "log-4",
      childId: "c1",
      boosted: true,
    } as any);
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "c1",
      treasurePityCount: 0,
    } as any);
    mockPrisma.treasureItem.findMany.mockResolvedValue([
      // 1/7 ≈ 0.143、boosted で 1.5/7 ≈ 0.214
      // rng=0.2 → 通常ハズレ、boosted ヒット
      { id: "i1", title: "おやつ", rarity: "COMMON", isActive: true } as any,
    ]);
    mockPrisma.treasureLog.update.mockResolvedValue({} as any);
    mockPrisma.user.update.mockResolvedValue({} as any);

    const result = await openOldestTreasure("c1", { rng: () => 0.2 });
    expect(result!.miss).toBe(false);
    expect(result!.item?.id).toBe("i1");
  });
});
