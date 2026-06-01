import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  generateTreasuresOnReport,
  unlockTreasuresOnApprove,
  cancelTreasuresOnReject,
  generateProxyTreasure,
  openOldestTreasure,
} from "@/lib/treasureService";
import { triggerCollectionItemLog } from "@/lib/bulletinLog";

vi.mock("@/lib/bulletinLog", () => ({
  triggerCollectionItemLog: vi.fn(),
}));

const mockPrisma = vi.mocked(prisma);
const mockTriggerCollectionLog = vi.mocked(triggerCollectionItemLog);

beforeEach(() => {
  vi.clearAllMocks();
});

const dateJST = new Date(Date.UTC(2026, 4, 27)); // 2026-05-27 JST

// ─── generateTreasuresOnReport ──────────────────────────────────────────────
describe("generateTreasuresOnReport", () => {
  beforeEach(() => {
    // 既定: プールに 1 件あるので生成は進む（プール空でも生成は走る仕様）
    mockPrisma.treasureItem.count.mockResolvedValue(1);
  });

  it("STREAK が既に OPENED 状態でも、その後 ALL_COMPLETE 条件が満たされたら ALL_COMPLETE を新規作成する", async () => {
    // ユーザー報告シナリオ:
    // 1. 報告 → STREAK 生成
    // 2. 親承認 → STREAK が UNLOCKED → 子が開封 → STREAK が OPENED
    // 3. 残りタスクをスキップして全部完了 → ALL_COMPLETE が出るべき
    mockPrisma.treasureLog.findMany.mockResolvedValue([
      { trigger: "STREAK" }, // status は問わない (OPENED でも CANCELLED でも)
    ] as any);
    mockPrisma.treasureLog.create.mockResolvedValueOnce({ id: "t-all" } as any);

    const ids = await generateTreasuresOnReport({
      childId: "c1",
      date: dateJST,
      reportedCount: 3,
      totalCount: 3,
      minTasks: 1,
      isProxy: false,
    });

    expect(ids).toEqual(["t-all"]);
    expect(mockPrisma.treasureLog.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.treasureLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        trigger: "ALL_COMPLETE",
        boosted: true,
        status: "LOCKED",
      }),
    });
  });

  it("プールが空 (treasureItem.count=0) でも生成する (開封時にコレクションアイテムが必ず出る)", async () => {
    mockPrisma.treasureItem.count.mockResolvedValue(0);
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

  // 親代理経路で先に PROXY 宝箱を作られていた日に、子セルフ報告が来た場合。
  // PROXY は STREAK の代替なので、STREAK を追加で作らない（重複防止）。
  // ALL_COMPLETE は全タスク完了のボーナス枠として PROXY と共存可。
  it("既存 PROXY があれば STREAK は作らない (PROXY は STREAK の代替)", async () => {
    mockPrisma.treasureLog.findMany.mockResolvedValue([
      { id: "p1", trigger: "PROXY" } as any,
    ]);
    const ids = await generateTreasuresOnReport({
      childId: "c1",
      date: dateJST,
      reportedCount: 1,
      totalCount: 3,
      minTasks: 1,
      isProxy: false,
    });
    expect(ids).toEqual([]);
    expect(mockPrisma.treasureLog.create).not.toHaveBeenCalled();
  });

  it("既存 PROXY + 全完了 → ALL_COMPLETE のみ作る (PROXY とは共存)", async () => {
    mockPrisma.treasureLog.findMany.mockResolvedValue([
      { id: "p1", trigger: "PROXY" } as any,
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
    expect(ids).toEqual(["t-all"]);
    expect(mockPrisma.treasureLog.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.treasureLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ trigger: "ALL_COMPLETE" }),
    });
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

  it("プールが空でも生成する (開封時にコレクションアイテムが必ず付与される)", async () => {
    mockPrisma.treasureItem.count.mockResolvedValue(0);
    mockPrisma.treasureLog.findFirst.mockResolvedValue(null);
    mockPrisma.treasureLog.create.mockResolvedValue({ id: "tp" } as any);
    const id = await generateProxyTreasure({
      childId: "c1",
      date: dateJST,
      reportedCount: 3,
      totalCount: 3,
      minTasks: 1,
    });
    expect(id).toBe("tp");
    expect(mockPrisma.treasureLog.create).toHaveBeenCalledTimes(1);
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

  it("当日既に PROXY 宝箱があれば作らない (冪等)", async () => {
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

  // 既存 STREAK / ALL_COMPLETE がある日には PROXY を追加しない (混合家庭の重複防止)
  // PROXY は「子セルフ報告で何も出ていない」家庭への補填なので、子供が既に STREAK を
  // 得ているなら親代理から追加で 1 個出すべきではない。
  it("当日既に STREAK 宝箱 (status 問わず) があれば PROXY は作らない", async () => {
    // generateProxyTreasure は findFirst を 1 回だけ呼ぶ実装に統合される
    mockPrisma.treasureLog.findFirst.mockResolvedValue({ id: "streak-1" } as any);
    const id = await generateProxyTreasure({
      childId: "c1",
      date: dateJST,
      reportedCount: 3,
      totalCount: 3,
      minTasks: 1,
    });
    expect(id).toBeNull();
    expect(mockPrisma.treasureLog.create).not.toHaveBeenCalled();
    // 検索条件: STREAK / ALL_COMPLETE / PROXY のいずれかで非 CANCELLED を含む
    const callArg = (mockPrisma.treasureLog.findFirst as any).mock.calls[0][0];
    expect(callArg.where.trigger).toEqual({ in: ["STREAK", "ALL_COMPLETE", "PROXY"] });
    expect(callArg.where.status).toEqual({ not: "CANCELLED" });
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
    expect(result!.collectionItem).toBeNull();
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
    expect(result!.collectionItem).toBeNull();
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("プールが空ならコレクションアイテムを付与 (item=null, pityCount は据え置き)", async () => {
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
    mockPrisma.userCollectionItem.upsert.mockResolvedValue({
      count: 1,
    } as any);

    const result = await openOldestTreasure("c1", { now: new Date("2026-07-15T03:00:00Z") });
    expect(result).not.toBeNull();
    expect(result!.item).toBeNull();
    // TreasureLog.collectionItemId に獲得したコレクション id が記録される (履歴表示用)
    expect(mockPrisma.treasureLog.update).toHaveBeenCalledWith({
      where: { id: "log-2" },
      data: expect.objectContaining({
        status: "OPENED",
        itemId: null,
        collectionItemId: expect.stringMatching(/^summer-\d+$/),
      }),
    });
    // プール空のときは pity を進めない (treasure.ts の仕様)
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
    // 親プールが無くても必ずコレクションアイテム付与
    expect(result!.collectionItem).not.toBeNull();
    expect(result!.collectionItem!.season).toBe("summer");
    expect(mockPrisma.userCollectionItem.upsert).toHaveBeenCalled();
  });

  it("親プールがあっても抽選結果が無アイテムなら pityCount +1 してコレクションを付与", async () => {
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
    mockPrisma.userCollectionItem.upsert.mockResolvedValue({
      count: 1,
    } as any);

    const result = await openOldestTreasure("c1", {
      rng: () => 0.99,
      now: new Date("2026-07-15T03:00:00Z"),
    });

    expect(result!.item).toBeNull();
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { treasurePityCount: 1 },
    });
    expect(result!.collectionItem).not.toBeNull();
    expect(result!.collectionItem!.season).toBe("summer");
  });

  it("親ごほうび当選時はコレクションアイテム付与しない", async () => {
    mockPrisma.treasureLog.findFirst.mockResolvedValue({
      id: "log-hit",
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

    const result = await openOldestTreasure("c1", {
      rng: () => 0.0,
      now: new Date("2026-07-15T03:00:00Z"),
    });
    expect(result!.collectionItem).toBeNull();
    expect(result!.collectionItem).toBeNull();
    expect(mockPrisma.userCollectionItem.upsert).not.toHaveBeenCalled();
  });

  it("ダブり獲得時 collectionItem.count に upsert 結果の値が入る", async () => {
    mockPrisma.treasureLog.findFirst.mockResolvedValue({
      id: "log-dup",
      childId: "c1",
      boosted: false,
    } as any);
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "c1",
      treasurePityCount: 0,
    } as any);
    mockPrisma.treasureItem.findMany.mockResolvedValue([]);
    mockPrisma.treasureLog.update.mockResolvedValue({} as any);
    mockPrisma.userCollectionItem.upsert.mockResolvedValue({
      count: 3,
    } as any);

    const result = await openOldestTreasure("c1", {
      now: new Date("2026-07-15T03:00:00Z"),
    });
    expect(result!.collectionItem!.count).toBe(3);
  });

  it("初獲得 (count===1) はひろば書き込みをトリガー (item id + count を渡す)", async () => {
    mockPrisma.treasureLog.findFirst.mockResolvedValue({
      id: "log-new", childId: "c1", boosted: false,
    } as any);
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "c1", treasurePityCount: 0,
    } as any);
    mockPrisma.treasureItem.findMany.mockResolvedValue([]);
    mockPrisma.treasureLog.update.mockResolvedValue({} as any);
    mockPrisma.userCollectionItem.upsert.mockResolvedValue({ count: 1 } as any);

    const result = await openOldestTreasure("c1", {
      now: new Date("2026-07-15T03:00:00Z"),
    });

    expect(mockTriggerCollectionLog).toHaveBeenCalledTimes(1);
    expect(mockTriggerCollectionLog).toHaveBeenCalledWith("c1", result!.collectionItem!.id, 1);
  });

  it("ダブり獲得 (count>=2) もひろば書き込みをトリガーする (count をそのまま渡す)", async () => {
    mockPrisma.treasureLog.findFirst.mockResolvedValue({
      id: "log-dup2", childId: "c1", boosted: false,
    } as any);
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "c1", treasurePityCount: 0,
    } as any);
    mockPrisma.treasureItem.findMany.mockResolvedValue([]);
    mockPrisma.treasureLog.update.mockResolvedValue({} as any);
    mockPrisma.userCollectionItem.upsert.mockResolvedValue({ count: 3 } as any);

    const result = await openOldestTreasure("c1", { now: new Date("2026-07-15T03:00:00Z") });
    expect(mockTriggerCollectionLog).toHaveBeenCalledTimes(1);
    expect(mockTriggerCollectionLog).toHaveBeenCalledWith("c1", result!.collectionItem!.id, 3);
  });

  it("親ごほうび当選時はコレクション書き込みをトリガーしない", async () => {
    mockPrisma.treasureLog.findFirst.mockResolvedValue({
      id: "log-hit2", childId: "c1", boosted: false,
    } as any);
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "c1", treasurePityCount: 0,
    } as any);
    mockPrisma.treasureItem.findMany.mockResolvedValue([
      { id: "item-1", title: "おやつ", rarity: "COMMON", isActive: true } as any,
    ]);
    mockPrisma.treasureLog.update.mockResolvedValue({} as any);

    await openOldestTreasure("c1", {
      rng: () => 0.0,
      now: new Date("2026-07-15T03:00:00Z"),
    });
    expect(mockTriggerCollectionLog).not.toHaveBeenCalled();
  });

  // 「夏は夏のアイテムしか出ない」の構造的ロックダウン
  // どんな rng シーケンスでも、シーズン外のアイテムは抽選プールに入らないことを担保する
  describe("コレクションアイテムは現在シーズンのものに必ず限定される", () => {
    const cases: Array<[string, Date, "spring" | "summer" | "fall" | "winter"]> = [
      ["JST 2026-04-15 → spring", new Date("2026-04-15T03:00:00Z"), "spring"],
      ["JST 2026-07-15 → summer", new Date("2026-07-15T03:00:00Z"), "summer"],
      ["JST 2026-10-15 → fall",   new Date("2026-10-15T03:00:00Z"), "fall"],
      ["JST 2026-01-15 → winter", new Date("2026-01-15T03:00:00Z"), "winter"],
      // シーズン境界 (JST 月初 0:00) ちょうど = 新シーズン
      ["JST 2026-06-01 00:00 → summer (前日まで春)", new Date("2026-05-31T15:00:00Z"), "summer"],
      ["JST 2026-05-31 23:59 → spring (境界直前)",   new Date("2026-05-31T14:59:00Z"), "spring"],
    ];

    it.each(cases)("%s", async (_label, now, expectedSeason) => {
      mockPrisma.treasureLog.findFirst.mockResolvedValue({
        id: "log-season",
        childId: "c1",
        boosted: false,
      } as any);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "c1",
        treasurePityCount: 0,
      } as any);
      mockPrisma.treasureItem.findMany.mockResolvedValue([]); // 親プール空 → 確実にコレクション枠
      mockPrisma.treasureLog.update.mockResolvedValue({} as any);
      mockPrisma.userCollectionItem.upsert.mockResolvedValue({ count: 1 } as any);

      // rng を変えても結果のシーズンは変わらない (構造的保証)
      for (const rngVal of [0.0, 0.05, 0.25, 0.5, 0.75, 0.99]) {
        const result = await openOldestTreasure("c1", {
          rng: () => rngVal,
          now,
        });
        expect(result!.collectionItem).not.toBeNull();
        expect(result!.collectionItem!.season).toBe(expectedSeason);
        expect(result!.collectionItem!.id.startsWith(`${expectedSeason}-`)).toBe(true);
      }
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
      // rng=0.2 → 通常は当選圏外、boosted で当選圏内
      { id: "i1", title: "おやつ", rarity: "COMMON", isActive: true } as any,
    ]);
    mockPrisma.treasureLog.update.mockResolvedValue({} as any);
    mockPrisma.user.update.mockResolvedValue({} as any);

    const result = await openOldestTreasure("c1", { rng: () => 0.2 });
    expect(result!.collectionItem).toBeNull();
    expect(result!.item?.id).toBe("i1");
  });
});
