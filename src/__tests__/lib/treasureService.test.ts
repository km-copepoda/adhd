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
    mockPrisma.treasureLog.findMany.mockResolvedValue([
      { trigger: "STREAK" },
    ] as any);
    mockPrisma.treasureLog.create.mockResolvedValueOnce({ id: "t-all" } as any);

    const ids = await generateTreasuresOnReport({
      childId: "c1",
      date: dateJST,
      reportedCount: 3,
      totalCount: 3,
      skippedCount: 0,
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
      skippedCount: 0,
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
      skippedCount: 0,
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
      skippedCount: 0,
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
      skippedCount: 0,
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
      skippedCount: 0,
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

  it("全完了だがスキップを含む → ALL_COMPLETE は boosted=false で生成", async () => {
    mockPrisma.treasureLog.findMany.mockResolvedValue([]);
    mockPrisma.treasureLog.create
      .mockResolvedValueOnce({ id: "t-streak" } as any)
      .mockResolvedValueOnce({ id: "t-all" } as any);

    const ids = await generateTreasuresOnReport({
      childId: "c1",
      date: dateJST,
      reportedCount: 3,
      totalCount: 3,
      skippedCount: 1, // 1 個でもスキップがあれば boost なし
      minTasks: 1,
      isProxy: false,
    });

    expect(ids).toEqual(["t-streak", "t-all"]);
    const calls = mockPrisma.treasureLog.create.mock.calls;
    expect(calls[1][0].data).toEqual(
      expect.objectContaining({ trigger: "ALL_COMPLETE", boosted: false, status: "LOCKED" }),
    );
  });

  it("全タスクスキップ (totalCount === skippedCount) → ALL_COMPLETE は boosted=false", async () => {
    mockPrisma.treasureLog.findMany.mockResolvedValue([]);
    mockPrisma.treasureLog.create
      .mockResolvedValueOnce({ id: "t-streak" } as any)
      .mockResolvedValueOnce({ id: "t-all" } as any);

    const ids = await generateTreasuresOnReport({
      childId: "c1",
      date: dateJST,
      reportedCount: 3,
      totalCount: 3,
      skippedCount: 3,
      minTasks: 1,
      isProxy: false,
    });

    expect(ids).toEqual(["t-streak", "t-all"]);
    const calls = mockPrisma.treasureLog.create.mock.calls;
    expect(calls[1][0].data).toEqual(
      expect.objectContaining({ trigger: "ALL_COMPLETE", boosted: false }),
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
      skippedCount: 0,
      minTasks: 1,
      isProxy: false,
    });
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
      skippedCount: 0,
      minTasks: 1,
      isProxy: false,
    });
    expect(ids).toEqual([]);
    expect(mockPrisma.treasureLog.create).not.toHaveBeenCalled();
  });

  // シナリオ: 3 タスク全完了で STREAK + ALL_COMPLETE 生成済み (OPENED でも可) の状態で、
  // 親 or 子があとからタスクを追加 (totalCount=4) → その追加タスクも完了して再び 4/4 になっても、
  // 当日同 trigger が既にあるので追加の宝箱は出ない (1日 1セットの上限を守る)
  it("全完了後にタスク追加→再全完了でも追加の宝箱は出ない", async () => {
    mockPrisma.treasureLog.findMany.mockResolvedValue([
      { id: "e1", trigger: "STREAK" } as any,
      { id: "e2", trigger: "ALL_COMPLETE" } as any,
    ]);
    const ids = await generateTreasuresOnReport({
      childId: "c1",
      date: dateJST,
      reportedCount: 4,
      totalCount: 4,
      skippedCount: 0,
      minTasks: 1,
      isProxy: false,
    });
    expect(ids).toEqual([]);
    expect(mockPrisma.treasureLog.create).not.toHaveBeenCalled();
  });

  it("既存 PROXY があれば STREAK は作らない (PROXY は STREAK の代替)", async () => {
    mockPrisma.treasureLog.findMany.mockResolvedValue([
      { id: "p1", trigger: "PROXY" } as any,
    ]);
    const ids = await generateTreasuresOnReport({
      childId: "c1",
      date: dateJST,
      reportedCount: 1,
      totalCount: 3,
      skippedCount: 0,
      minTasks: 1,
      isProxy: false,
    });
    expect(ids).toEqual([]);
    expect(mockPrisma.treasureLog.create).not.toHaveBeenCalled();
  });

  // 差し戻し → 再報告のシナリオ: 一度 STREAK を作って親が差し戻し、cancelTreasuresOnReject で
  // CANCELLED になった後、子供が再報告して再びストリーク条件を満たした場合に
  // 新しい STREAK を作り直せる必要がある (CANCELLED は "存在しない" 扱い)。
  it("既存 STREAK が CANCELLED のみなら再生成する (差し戻し→再報告)", async () => {
    // CANCELLED は findMany で除外されている前提なので、戻り値は空
    mockPrisma.treasureLog.findMany.mockResolvedValue([]);
    mockPrisma.treasureLog.create.mockResolvedValue({ id: "t-streak-2" } as any);

    const ids = await generateTreasuresOnReport({
      childId: "c1",
      date: dateJST,
      reportedCount: 1,
      totalCount: 3,
      skippedCount: 0,
      minTasks: 1,
      isProxy: false,
    });

    expect(ids).toEqual(["t-streak-2"]);
    expect(mockPrisma.treasureLog.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.treasureLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ trigger: "STREAK", status: "LOCKED" }),
    });
    // CANCELLED を除外するクエリになっていることを確認
    expect(mockPrisma.treasureLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { not: "CANCELLED" },
        }),
      }),
    );
  });

  // recordDailyAchievement (streak.ts) が `required = Math.min(minTasks, totalCount)` で
  // 少タスク日を救済しているのと同じ規約を宝箱側でも適用する。今日タスクが minTasks より少ない
  // 家庭で「全部やったのに宝箱が出ない」体験を防ぐ。
  it("totalCount < minTasks でも全完了なら STREAK + ALL_COMPLETE を両方生成する", async () => {
    mockPrisma.treasureLog.findMany.mockResolvedValue([]);
    // mockResolvedValueOnce のキューは vi.clearAllMocks では消えないので mockResolvedValue で統一
    mockPrisma.treasureLog.create.mockResolvedValue({ id: "created" } as any);

    const ids = await generateTreasuresOnReport({
      childId: "c1",
      date: dateJST,
      reportedCount: 2,
      totalCount: 2, // 今日は 2 個しかない
      skippedCount: 0,
      minTasks: 5, // 設定は 5 個
      isProxy: false,
    });

    expect(ids).toHaveLength(2);
    const calls = mockPrisma.treasureLog.create.mock.calls;
    expect(calls[0][0].data).toEqual(
      expect.objectContaining({ trigger: "STREAK", status: "LOCKED" }),
    );
    expect(calls[1][0].data).toEqual(
      expect.objectContaining({ trigger: "ALL_COMPLETE", boosted: true, status: "LOCKED" }),
    );
  });

  it("totalCount < minTasks で未全完了なら何もしない（STREAK 単独発火はさせない）", async () => {
    mockPrisma.treasureLog.findMany.mockResolvedValue([]);
    const ids = await generateTreasuresOnReport({
      childId: "c1",
      date: dateJST,
      reportedCount: 1,
      totalCount: 2, // 全完了になっていない
      skippedCount: 0,
      minTasks: 5,
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
      skippedCount: 0,
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
      skippedCount: 0,
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
      skippedCount: 0,
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
      skippedCount: 0,
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
    mockPrisma.treasureLog.findMany.mockResolvedValue([]);
    mockPrisma.treasureLog.create
      .mockResolvedValueOnce({ id: "tp" } as any)
      .mockResolvedValueOnce({ id: "tp-all" } as any);
    const ids = await generateProxyTreasure({
      childId: "c1",
      date: dateJST,
      reportedCount: 3,
      totalCount: 3,
      skippedCount: 0,
      minTasks: 1,
    });
    // 全完了なので PROXY + ALL_COMPLETE の 2 個
    expect(ids).toEqual(["tp", "tp-all"]);
  });

  it("minTasks 未達なら空配列", async () => {
    const ids = await generateProxyTreasure({
      childId: "c1",
      date: dateJST,
      reportedCount: 0,
      totalCount: 3,
      skippedCount: 0,
      minTasks: 1,
    });
    expect(ids).toEqual([]);
    expect(mockPrisma.treasureLog.create).not.toHaveBeenCalled();
  });

  // generateTreasuresOnReport と同じ Math.min(minTasks, totalCount) 救済を親代理経路にも適用。
  // 親端末しかない家庭で「今日は 2 個しかタスク無いのに minTasks=5 なので宝箱ゼロ」を防ぐ。
  it("totalCount < minTasks でも全完了なら PROXY + ALL_COMPLETE を即 UNLOCKED で生成", async () => {
    mockPrisma.treasureLog.findMany.mockResolvedValue([]);
    // mockResolvedValueOnce のキューは vi.clearAllMocks では消えないので mockResolvedValue で統一
    mockPrisma.treasureLog.create.mockResolvedValue({ id: "created" } as any);

    const ids = await generateProxyTreasure({
      childId: "c1",
      date: dateJST,
      reportedCount: 2,
      totalCount: 2,
      skippedCount: 0,
      minTasks: 5,
    });

    expect(ids).toHaveLength(2);
    const calls = mockPrisma.treasureLog.create.mock.calls;
    expect(calls[0][0].data).toEqual(
      expect.objectContaining({ trigger: "PROXY", status: "UNLOCKED" }),
    );
    expect(calls[1][0].data).toEqual(
      expect.objectContaining({ trigger: "ALL_COMPLETE", boosted: true, status: "UNLOCKED" }),
    );
  });

  it("条件を満たす + 未全完了 → PROXY 1個のみ", async () => {
    mockPrisma.treasureLog.findMany.mockResolvedValue([]);
    mockPrisma.treasureLog.create.mockResolvedValueOnce({ id: "tp" } as any);
    const ids = await generateProxyTreasure({
      childId: "c1",
      date: dateJST,
      reportedCount: 1,
      totalCount: 3,
      skippedCount: 0,
      minTasks: 1,
    });
    expect(ids).toEqual(["tp"]);
    expect(mockPrisma.treasureLog.create).toHaveBeenCalledTimes(1);
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

  it("全完了 → PROXY + ALL_COMPLETE(boosted) の即 UNLOCKED 2個", async () => {
    mockPrisma.treasureLog.findMany.mockResolvedValue([]);
    mockPrisma.treasureLog.create
      .mockResolvedValueOnce({ id: "tp" } as any)
      .mockResolvedValueOnce({ id: "tp-all" } as any);
    const ids = await generateProxyTreasure({
      childId: "c1",
      date: dateJST,
      reportedCount: 3,
      totalCount: 3,
      skippedCount: 0,
      minTasks: 1,
    });
    expect(ids).toEqual(["tp", "tp-all"]);
    const calls = mockPrisma.treasureLog.create.mock.calls;
    expect(calls[0][0].data).toEqual(
      expect.objectContaining({ trigger: "PROXY", boosted: false, status: "UNLOCKED" }),
    );
    expect(calls[1][0].data).toEqual(
      expect.objectContaining({ trigger: "ALL_COMPLETE", boosted: true, status: "UNLOCKED" }),
    );
  });

  it("全完了だがスキップを含む → ALL_COMPLETE は boosted=false", async () => {
    mockPrisma.treasureLog.findMany.mockResolvedValue([]);
    mockPrisma.treasureLog.create
      .mockResolvedValueOnce({ id: "tp" } as any)
      .mockResolvedValueOnce({ id: "tp-all" } as any);
    const ids = await generateProxyTreasure({
      childId: "c1",
      date: dateJST,
      reportedCount: 3,
      totalCount: 3,
      skippedCount: 1,
      minTasks: 1,
    });
    expect(ids).toEqual(["tp", "tp-all"]);
    const calls = mockPrisma.treasureLog.create.mock.calls;
    expect(calls[1][0].data).toEqual(
      expect.objectContaining({ trigger: "ALL_COMPLETE", boosted: false }),
    );
  });

  it("当日既に PROXY 宝箱があれば PROXY は作らない (冪等) — 全完了なら ALL_COMPLETE のみ作る", async () => {
    mockPrisma.treasureLog.findMany.mockResolvedValue([
      { trigger: "PROXY" } as any,
    ]);
    mockPrisma.treasureLog.create.mockResolvedValueOnce({ id: "tp-all" } as any);
    const ids = await generateProxyTreasure({
      childId: "c1",
      date: dateJST,
      reportedCount: 3,
      totalCount: 3,
      skippedCount: 0,
      minTasks: 1,
    });
    expect(ids).toEqual(["tp-all"]);
    expect(mockPrisma.treasureLog.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.treasureLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ trigger: "ALL_COMPLETE", status: "UNLOCKED" }),
    });
  });

  it("当日既に STREAK 宝箱があれば PROXY は作らない — 全完了なら ALL_COMPLETE を追加 (混合家庭)", async () => {
    mockPrisma.treasureLog.findMany.mockResolvedValue([
      { trigger: "STREAK" } as any,
    ]);
    mockPrisma.treasureLog.create.mockResolvedValueOnce({ id: "tp-all" } as any);
    const ids = await generateProxyTreasure({
      childId: "c1",
      date: dateJST,
      reportedCount: 3,
      totalCount: 3,
      skippedCount: 0,
      minTasks: 1,
    });
    expect(ids).toEqual(["tp-all"]);
    expect(mockPrisma.treasureLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ trigger: "ALL_COMPLETE", status: "UNLOCKED" }),
    });
    // 集約クエリで CANCELLED を除外していることも担保
    const callArg = (mockPrisma.treasureLog.findMany as any).mock.calls[0][0];
    expect(callArg.where.trigger).toEqual({ in: ["STREAK", "ALL_COMPLETE", "PROXY"] });
    expect(callArg.where.status).toEqual({ not: "CANCELLED" });
  });

  it("当日既に STREAK + ALL_COMPLETE があれば何も作らない (完全冪等)", async () => {
    mockPrisma.treasureLog.findMany.mockResolvedValue([
      { trigger: "STREAK" } as any,
      { trigger: "ALL_COMPLETE" } as any,
    ]);
    const ids = await generateProxyTreasure({
      childId: "c1",
      date: dateJST,
      reportedCount: 3,
      totalCount: 3,
      skippedCount: 0,
      minTasks: 1,
    });
    expect(ids).toEqual([]);
    expect(mockPrisma.treasureLog.create).not.toHaveBeenCalled();
  });

  it("未全完了で PROXY 既存なら何も作らない", async () => {
    mockPrisma.treasureLog.findMany.mockResolvedValue([
      { trigger: "PROXY" } as any,
    ]);
    const ids = await generateProxyTreasure({
      childId: "c1",
      date: dateJST,
      reportedCount: 2,
      totalCount: 3,
      skippedCount: 0,
      minTasks: 1,
    });
    expect(ids).toEqual([]);
    expect(mockPrisma.treasureLog.create).not.toHaveBeenCalled();
  });
});

// ─── openOldestTreasure ─────────────────────────────────────────────────────
describe("openOldestTreasure", () => {
  beforeEach(() => {
    // pity カウンタの既定値 (各テストで上書き可)
    mockPrisma.user.findUnique.mockResolvedValue({ treasurePityCount: 0 } as any);
    mockPrisma.user.update.mockResolvedValue({} as any);
  });

  it("UNLOCKED 宝箱が無いとき null", async () => {
    mockPrisma.treasureLog.findFirst.mockResolvedValue(null);
    const result = await openOldestTreasure("c1");
    expect(result).toBeNull();
  });

  it("最古の UNLOCKED を取得し抽選してアイテム確定", async () => {
    mockPrisma.treasureLog.findFirst.mockResolvedValue({
      id: "log-1",
      childId: "c1",
      boosted: false,
    } as any);
    mockPrisma.treasureItem.findMany.mockResolvedValue([
      { id: "item-1", title: "おやつ", rarity: "COMMON", isActive: true } as any,
    ]);
    mockPrisma.treasureLog.update.mockResolvedValue({} as any);

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
    // pityCount=0 → HIT → nextPityCount=0 (変化なし) なので User.update は呼ばれない
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("親ごほうび当選時で pityCount=0 のままなら User.update はスキップする", async () => {
    mockPrisma.treasureLog.findFirst.mockResolvedValue({
      id: "log-1b",
      childId: "c1",
      boosted: false,
    } as any);
    mockPrisma.treasureItem.findMany.mockResolvedValue([
      { id: "item-1", title: "おやつ", rarity: "COMMON", isActive: true } as any,
    ]);
    mockPrisma.treasureLog.update.mockResolvedValue({} as any);

    const result = await openOldestTreasure("c1", { rng: () => 0.0 });
    expect(result!.collectionItem).toBeNull();
    // 値が変わらないときは update をスキップ (DB ノイズを減らす)
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
    // pity カウンタと familyId (プラン判定用) を読み出すために findUnique は必ず呼ぶ
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: "c1" },
      select: { treasurePityCount: true, familyId: true },
    });
  });

  it("プールが空ならコレクションアイテムを付与 (item=null)", async () => {
    mockPrisma.treasureLog.findFirst.mockResolvedValue({
      id: "log-2",
      childId: "c1",
      boosted: false,
    } as any);
    mockPrisma.treasureItem.findMany.mockResolvedValue([]);
    mockPrisma.treasureLog.update.mockResolvedValue({} as any);
    mockPrisma.userCollectionItem.upsert.mockResolvedValue({
      count: 1,
    } as any);

    const result = await openOldestTreasure("c1", { now: new Date("2026-07-15T03:00:00Z") });
    expect(result).not.toBeNull();
    expect(result!.item).toBeNull();
    expect(mockPrisma.treasureLog.update).toHaveBeenCalledWith({
      where: { id: "log-2" },
      data: expect.objectContaining({
        status: "OPENED",
        itemId: null,
        // summer-XX (通常) または m07-XX (月限定) のどちらか
        collectionItemId: expect.stringMatching(/^(summer-\d+|m07-\d+)$/),
      }),
    });
    // MISS なので pityCount 0→1 で User.update が呼ばれる
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { treasurePityCount: 1 },
    });
    expect(result!.collectionItem).not.toBeNull();
    expect(result!.collectionItem!.season).toBe("summer");
    expect(mockPrisma.userCollectionItem.upsert).toHaveBeenCalled();
  });

  it("親プールがあっても抽選結果が無アイテムならコレクションを付与", async () => {
    mockPrisma.treasureLog.findFirst.mockResolvedValue({
      id: "log-3",
      childId: "c1",
      boosted: false,
    } as any);
    mockPrisma.treasureItem.findMany.mockResolvedValue([
      { id: "item-1", title: "おやつ", rarity: "COMMON", isActive: true } as any,
    ]);
    mockPrisma.treasureLog.update.mockResolvedValue({} as any);
    mockPrisma.userCollectionItem.upsert.mockResolvedValue({
      count: 1,
    } as any);

    const result = await openOldestTreasure("c1", {
      rng: () => 0.99,
      now: new Date("2026-07-15T03:00:00Z"),
    });

    expect(result!.item).toBeNull();
    // MISS で pityCount 0→1
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
    mockPrisma.treasureItem.findMany.mockResolvedValue([
      { id: "item-1", title: "おやつ", rarity: "COMMON", isActive: true } as any,
    ]);
    mockPrisma.treasureLog.update.mockResolvedValue({} as any);

    const result = await openOldestTreasure("c1", {
      rng: () => 0.0,
      now: new Date("2026-07-15T03:00:00Z"),
    });
    expect(result!.collectionItem).toBeNull();
    expect(mockPrisma.userCollectionItem.upsert).not.toHaveBeenCalled();
  });

  // ─── pity (天井) 統合テスト — 2026-06-24 復活 ────────────────────────────
  describe("pity (天井) — User.treasurePityCount 連携", () => {
    it("HIT 時: pityCount を 0 にリセットする (5 → 0)", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ treasurePityCount: 5 } as any);
      mockPrisma.treasureLog.findFirst.mockResolvedValue({
        id: "log-pity-hit", childId: "c1", boosted: false,
      } as any);
      mockPrisma.treasureItem.findMany.mockResolvedValue([
        { id: "item-1", title: "おやつ", rarity: "COMMON", isActive: true } as any,
      ]);
      mockPrisma.treasureLog.update.mockResolvedValue({} as any);

      const result = await openOldestTreasure("c1", { rng: () => 0.0 });
      expect(result!.item?.id).toBe("item-1");
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: "c1" },
        data: { treasurePityCount: 0 },
      });
    });

    it("MISS 時: pityCount を +1 する (3 → 4)", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ treasurePityCount: 3 } as any);
      mockPrisma.treasureLog.findFirst.mockResolvedValue({
        id: "log-pity-miss", childId: "c1", boosted: false,
      } as any);
      mockPrisma.treasureItem.findMany.mockResolvedValue([
        { id: "item-1", title: "おやつ", rarity: "COMMON", isActive: true } as any,
      ]);
      mockPrisma.treasureLog.update.mockResolvedValue({} as any);
      mockPrisma.userCollectionItem.upsert.mockResolvedValue({ count: 1 } as any);

      const result = await openOldestTreasure("c1", {
        rng: () => 0.99,
        now: new Date("2026-07-15T03:00:00Z"),
      });
      expect(result!.item).toBeNull();
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: "c1" },
        data: { treasurePityCount: 4 },
      });
    });

    it("pityCount=9 で MISS rng → pity 発動: 親ごほうび確定 + pityCount=0 リセット", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ treasurePityCount: 9 } as any);
      mockPrisma.treasureLog.findFirst.mockResolvedValue({
        id: "log-pity-trigger", childId: "c1", boosted: false,
      } as any);
      mockPrisma.treasureItem.findMany.mockResolvedValue([
        { id: "item-1", title: "おやつ", rarity: "COMMON", isActive: true } as any,
      ]);
      mockPrisma.treasureLog.update.mockResolvedValue({} as any);

      const result = await openOldestTreasure("c1", {
        rng: () => 0.99,
        now: new Date("2026-07-15T03:00:00Z"),
      });
      // pity 発動 → 親ごほうび当選扱い、コレクションは付与しない
      expect(result!.item?.id).toBe("item-1");
      expect(result!.collectionItem).toBeNull();
      expect(mockPrisma.userCollectionItem.upsert).not.toHaveBeenCalled();
      // pityCount リセット
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: "c1" },
        data: { treasurePityCount: 0 },
      });
    });

    it("pityCount=9 でプール空 → pity 発動できず MISS のままだが pityCount は +1", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ treasurePityCount: 9 } as any);
      mockPrisma.treasureLog.findFirst.mockResolvedValue({
        id: "log-pity-empty", childId: "c1", boosted: false,
      } as any);
      mockPrisma.treasureItem.findMany.mockResolvedValue([]);
      mockPrisma.treasureLog.update.mockResolvedValue({} as any);
      mockPrisma.userCollectionItem.upsert.mockResolvedValue({ count: 1 } as any);

      const result = await openOldestTreasure("c1", {
        now: new Date("2026-07-15T03:00:00Z"),
      });
      // プール空なので親ごほうび当選不可、コレクション付与
      expect(result!.item).toBeNull();
      expect(result!.collectionItem).not.toBeNull();
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: "c1" },
        data: { treasurePityCount: 10 },
      });
    });
  });

  it("ダブり獲得時 collectionItem.count に upsert 結果の値が入る", async () => {
    mockPrisma.treasureLog.findFirst.mockResolvedValue({
      id: "log-dup",
      childId: "c1",
      boosted: false,
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
  // 月限定アイテム (2026-07-21 追加) も season フィールドを持つため、
  // 現在シーズンの通常20 + 現在月の限定5 = 25個のプールから引かれる。
  describe("コレクションアイテムは現在シーズン（通常 or 月限定）のものに必ず限定される", () => {
    const cases: Array<[string, Date, "spring" | "summer" | "fall" | "winter", number]> = [
      ["JST 2026-04-15 → spring / m04", new Date("2026-04-15T03:00:00Z"), "spring", 4],
      ["JST 2026-07-15 → summer / m07", new Date("2026-07-15T03:00:00Z"), "summer", 7],
      ["JST 2026-10-15 → fall / m10",   new Date("2026-10-15T03:00:00Z"), "fall",   10],
      ["JST 2026-01-15 → winter / m01", new Date("2026-01-15T03:00:00Z"), "winter", 1],
      ["JST 2026-06-01 00:00 → summer / m06 (前日まで春)", new Date("2026-05-31T15:00:00Z"), "summer", 6],
      ["JST 2026-05-31 23:59 → spring / m05 (境界直前)",   new Date("2026-05-31T14:59:00Z"), "spring", 5],
    ];

    it.each(cases)("%s", async (_label, now, expectedSeason, expectedMonth) => {
      mockPrisma.treasureLog.findFirst.mockResolvedValue({
        id: "log-season",
        childId: "c1",
        boosted: false,
      } as any);
      mockPrisma.treasureItem.findMany.mockResolvedValue([]);
      mockPrisma.treasureLog.update.mockResolvedValue({} as any);
      mockPrisma.userCollectionItem.upsert.mockResolvedValue({ count: 1 } as any);

      const monthPrefix = `m${String(expectedMonth).padStart(2, "0")}-`;
      for (const rngVal of [0.0, 0.05, 0.25, 0.5, 0.75, 0.99]) {
        const result = await openOldestTreasure("c1", {
          rng: () => rngVal,
          now,
        });
        expect(result!.collectionItem).not.toBeNull();
        // season は必ず現在シーズン
        expect(result!.collectionItem!.season).toBe(expectedSeason);
        // 通常アイテム (season-XX) または 当月限定 (m{MM}-XX) のいずれか
        const id = result!.collectionItem!.id;
        const isRegular = id.startsWith(`${expectedSeason}-`);
        const isCurrentMonth = id.startsWith(monthPrefix);
        expect(isRegular || isCurrentMonth).toBe(true);
      }
    });
  });

  // 月限定アイテム（2026-07-21 追加）が抽選プールに含まれることの担保
  describe("月限定アイテムが抽選プールに含まれる", () => {
    it("JST 7月中に MISS すると m07-XX が引かれることがある (rng を振って月限定にヒットさせる)", async () => {
      mockPrisma.treasureLog.findFirst.mockResolvedValue({
        id: "log-monthly", childId: "c1", boosted: false,
      } as any);
      mockPrisma.treasureItem.findMany.mockResolvedValue([]);
      mockPrisma.treasureLog.update.mockResolvedValue({} as any);
      mockPrisma.userCollectionItem.upsert.mockResolvedValue({ count: 1 } as any);

      // rng を細かく振って、いずれかで m07-XX を引けることを確認する。
      // 25 種プール (summer 20 + m07 5) からユニフォーム抽選なので、tier 内で 2 回目 rng を
      // 大きく振れば m07 (常に prefix ソートで後方に来るとは限らないが) が引ける組み合わせが必ずある。
      const monthlyHits = new Set<string>();
      for (let a = 0; a < 100; a++) {
        for (let b = 0; b < 5; b++) {
          const seq = [a / 100, b / 5];
          let i = 0;
          const result = await openOldestTreasure("c1", {
            rng: () => seq[i++ % seq.length],
            now: new Date("2026-07-15T03:00:00Z"),
          });
          if (result?.collectionItem?.id.startsWith("m07-")) {
            monthlyHits.add(result.collectionItem.id);
          }
        }
      }
      // 月限定 5 種のうち少なくとも 1 種は引けるはず (プールに絶対に含まれているので)
      expect(monthlyHits.size).toBeGreaterThan(0);
    });
  });

  it("boosted ログは抽選オプションに boosted=true を渡す", async () => {
    mockPrisma.treasureLog.findFirst.mockResolvedValue({
      id: "log-4",
      childId: "c1",
      boosted: true,
    } as any);
    mockPrisma.treasureItem.findMany.mockResolvedValue([
      // COMMON 1/10 = 0.1、boosted で 1.5/10 = 0.15
      // 合計 hit 率: 通常 31/180 ≈ 0.172、boosted で 31/120 ≈ 0.258
      // rng=0.2 → 通常 (>0.172) は MISS、boosted (<0.258) で COMMON 当選
      { id: "i1", title: "おやつ", rarity: "COMMON", isActive: true } as any,
    ]);
    mockPrisma.treasureLog.update.mockResolvedValue({} as any);

    const result = await openOldestTreasure("c1", { rng: () => 0.2 });
    expect(result!.collectionItem).toBeNull();
    expect(result!.item?.id).toBe("i1");
  });
});
