import { describe, it, expect, beforeEach } from "vitest";
import { rescueOrphanTreasures } from "@/lib/orphanTreasureRescue";
import { prismaMock as mockPrisma } from "../helpers/prisma-mock";
import { treasureLog, questWithTemplate } from "../helpers/fixtures";

/**
 * rescueOrphanTreasures の単体テスト（Issue #109）。
 *
 * classifyOrphanTreasure (src/lib/orphanTreasure.ts) を使って開かずの宝箱候補を分類し、
 * dryRun=false のときのみ treasureLog.updateMany で実際に書き込む。
 *
 * 実際の「今日」に依存させないため、全テストで `before` オプションを明示的に渡す。
 */

function d(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

// 分類対象 TreasureLog.date (D)。before はこれより後の日付を渡し「過去」として扱わせる。
const D = d(2026, 8, 20);
const BEFORE = d(2026, 8, 22);

beforeEach(() => {
  mockPrisma.treasureLog.findMany.mockReset();
  mockPrisma.questInstance.findMany.mockReset();
  mockPrisma.treasureLog.updateMany.mockReset();
});

describe("rescueOrphanTreasures", () => {
  it("dryRun: true では treasureLog.updateMany が一度も呼ばれない（集計結果だけ返る）", async () => {
    mockPrisma.treasureLog.findMany.mockResolvedValue([
      treasureLog({ id: "t1", childId: "child-1", date: D, status: "LOCKED" }),
    ]);
    mockPrisma.questInstance.findMany.mockResolvedValue([
      questWithTemplate(
        { id: "q1", childId: "child-1", date: D, status: "APPROVED", reportedAt: D },
        { carryOver: false },
      ),
    ]);

    const result = await rescueOrphanTreasures({ dryRun: true, before: BEFORE });

    expect(mockPrisma.treasureLog.updateMany).not.toHaveBeenCalled();
    expect(result.unlocked.map((u) => u.id)).toEqual(["t1"]);
    expect(result.cancelled).toEqual([]);
    expect(result.skipped).toEqual([]);
  });

  it("dryRun: false で UNLOCK群がstatus:LOCKEDガード付きでupdateManyされる", async () => {
    mockPrisma.treasureLog.findMany.mockResolvedValue([
      treasureLog({ id: "t1", childId: "child-1", date: D, status: "LOCKED" }),
    ]);
    mockPrisma.questInstance.findMany.mockResolvedValue([
      questWithTemplate(
        { id: "q1", childId: "child-1", date: D, status: "APPROVED", reportedAt: D },
        { carryOver: false },
      ),
    ]);
    mockPrisma.treasureLog.updateMany.mockResolvedValue({ count: 1 });

    const result = await rescueOrphanTreasures({ dryRun: false, before: BEFORE });

    expect(result.unlocked.map((u) => u.id)).toEqual(["t1"]);
    expect(mockPrisma.treasureLog.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["t1"] }, status: "LOCKED" },
      data: { status: "UNLOCKED" },
    });
  });

  it("CANCEL群は別のupdateManyでstatus:CANCELLEDに更新される", async () => {
    mockPrisma.treasureLog.findMany.mockResolvedValue([
      treasureLog({ id: "t2", childId: "child-1", date: D, status: "LOCKED" }),
    ]);
    mockPrisma.questInstance.findMany.mockResolvedValue([
      questWithTemplate(
        { id: "q2", childId: "child-1", date: D, status: "REJECTED", reportedAt: D },
        { carryOver: false },
      ),
    ]);
    mockPrisma.treasureLog.updateMany.mockResolvedValue({ count: 1 });

    const result = await rescueOrphanTreasures({ dryRun: false, before: BEFORE });

    expect(result.cancelled.map((c) => c.id)).toEqual(["t2"]);
    expect(mockPrisma.treasureLog.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["t2"] }, status: "LOCKED" },
      data: { status: "CANCELLED" },
    });
  });

  it("UNLOCK群とCANCEL群が両方ある場合、別々のupdateMany呼び出しになる", async () => {
    mockPrisma.treasureLog.findMany.mockResolvedValue([
      treasureLog({ id: "t-unlock", childId: "child-1", date: D, status: "LOCKED" }),
      treasureLog({ id: "t-cancel", childId: "child-2", date: D, status: "LOCKED" }),
    ]);
    mockPrisma.questInstance.findMany.mockImplementation((args?: unknown) => {
      const where = (args as { where?: { childId?: string } } | undefined)?.where;
      if (where?.childId === "child-1") {
        return Promise.resolve([
          questWithTemplate(
            { id: "q-u", childId: "child-1", date: D, status: "APPROVED", reportedAt: D },
            { carryOver: false },
          ),
        ]);
      }
      return Promise.resolve([
        questWithTemplate(
          { id: "q-c", childId: "child-2", date: D, status: "REJECTED", reportedAt: D },
          { carryOver: false },
        ),
      ]);
    });
    mockPrisma.treasureLog.updateMany.mockResolvedValue({ count: 1 });

    const result = await rescueOrphanTreasures({ dryRun: false, before: BEFORE });

    expect(result.unlocked.map((u) => u.id)).toEqual(["t-unlock"]);
    expect(result.cancelled.map((c) => c.id)).toEqual(["t-cancel"]);
    expect(mockPrisma.treasureLog.updateMany).toHaveBeenCalledTimes(2);
    expect(mockPrisma.treasureLog.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["t-unlock"] }, status: "LOCKED" },
      data: { status: "UNLOCKED" },
    });
    expect(mockPrisma.treasureLog.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["t-cancel"] }, status: "LOCKED" },
      data: { status: "CANCELLED" },
    });
  });

  it("対象が0件のときupdateManyを呼ばない", async () => {
    mockPrisma.treasureLog.findMany.mockResolvedValue([]);

    const result = await rescueOrphanTreasures({ dryRun: false, before: BEFORE });

    expect(mockPrisma.treasureLog.updateMany).not.toHaveBeenCalled();
    expect(result.unlocked).toEqual([]);
    expect(result.cancelled).toEqual([]);
    expect(result.skipped).toEqual([]);
  });

  it("戻り値に救済した全idと分類理由が含まれる（監査ログ用）", async () => {
    mockPrisma.treasureLog.findMany.mockResolvedValue([
      treasureLog({ id: "t1", childId: "child-1", date: D, status: "LOCKED" }),
    ]);
    mockPrisma.questInstance.findMany.mockResolvedValue([
      questWithTemplate(
        { id: "q1", childId: "child-1", date: D, status: "APPROVED", reportedAt: D },
        { carryOver: false },
      ),
    ]);
    mockPrisma.treasureLog.updateMany.mockResolvedValue({ count: 1 });

    const result = await rescueOrphanTreasures({ dryRun: false, before: BEFORE });

    expect(result.unlocked).toHaveLength(1);
    expect(result.unlocked[0]).toEqual(
      expect.objectContaining({ id: "t1", childId: "child-1", reason: expect.any(String) }),
    );
  });

  it("支配クエストが見つからないものはskippedに分類され、reasonにUNRESOLVEDを含む", async () => {
    mockPrisma.treasureLog.findMany.mockResolvedValue([
      treasureLog({ id: "t-orphan", childId: "child-1", date: D, status: "LOCKED" }),
    ]);
    mockPrisma.questInstance.findMany.mockResolvedValue([]);

    const result = await rescueOrphanTreasures({ dryRun: false, before: BEFORE });

    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]).toEqual(
      expect.objectContaining({ id: "t-orphan", reason: expect.stringContaining("UNRESOLVED") }),
    );
    expect(mockPrisma.treasureLog.updateMany).not.toHaveBeenCalled();
  });

  it("childIdオプション指定時、treasureLog.findManyのwhereにchildIdが含まれる", async () => {
    mockPrisma.treasureLog.findMany.mockResolvedValue([]);

    await rescueOrphanTreasures({ dryRun: true, before: BEFORE, childId: "child-9" });

    expect(mockPrisma.treasureLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ childId: "child-9" }),
      }),
    );
  });

  it("limitオプションが件数を制限する", async () => {
    mockPrisma.treasureLog.findMany.mockResolvedValue([]);

    await rescueOrphanTreasures({ dryRun: true, before: BEFORE, limit: 50 });

    expect(mockPrisma.treasureLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50 }),
    );
  });

  it("2回目の実行（候補が空で返る状態）で対象0件・updateMany未呼び出し（冪等）", async () => {
    // 1回目の救済で LOCKED が無くなった後を想定し、2回目は最初から空を返す
    mockPrisma.treasureLog.findMany.mockResolvedValue([]);

    const result = await rescueOrphanTreasures({ dryRun: false, before: BEFORE });

    expect(result.unlocked).toEqual([]);
    expect(result.cancelled).toEqual([]);
    expect(result.skipped).toEqual([]);
    expect(mockPrisma.treasureLog.updateMany).not.toHaveBeenCalled();
  });
});
