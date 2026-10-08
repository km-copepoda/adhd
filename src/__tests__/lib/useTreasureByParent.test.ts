// #164: 親が承認なしで直接ごほうびを「使用済み」にする DB 操作（src/lib/approve.ts）。
// UNUSED | USE_REQUESTED -> USED。XP/進化/ストリーク/バッジには触れない。
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useTreasureByParent, approveTreasureUse, autoApproveStaleTreasureUses } from "@/lib/approve";
import { prismaMock as mockPrisma } from "@/__tests__/helpers/prisma-mock";

const FIXED_NOW = new Date("2026-05-29T10:00:00Z");

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
  mockPrisma.treasureLog.updateMany.mockResolvedValue({ count: 1 });
});

afterEach(() => {
  vi.useRealTimers();
});

type UpdateManyArg = {
  where: { id?: string; useStatus?: { in?: string[] } | string };
  data: Record<string, unknown>;
};

function lastCall(): UpdateManyArg {
  return mockPrisma.treasureLog.updateMany.mock.calls[0][0] as unknown as UpdateManyArg;
}

describe("useTreasureByParent (#164)", () => {
  it("where は id と useStatus in [UNUSED, USE_REQUESTED] のみ（USED は含めない）", async () => {
    await useTreasureByParent("t1");
    const { where } = lastCall();
    expect(where.id).toBe("t1");
    const inList = (where.useStatus as { in: string[] }).in;
    expect([...inList].sort()).toEqual(["UNUSED", "USE_REQUESTED"]);
    expect(inList).not.toContain("USED");
  });

  it("data に useStatus=USED と fulfilled=true が同時に書かれる", async () => {
    await useTreasureByParent("t1");
    expect(lastCall().data).toMatchObject({ useStatus: "USED", fulfilled: true });
  });

  it("useApprovedAt が現在時刻で設定される", async () => {
    await useTreasureByParent("t1");
    expect(lastCall().data.useApprovedAt).toEqual(FIXED_NOW);
  });

  it("data に useRequestedAt を含めない（UNUSED起点は null のまま・申請済みは元の時刻を保持）", async () => {
    await useTreasureByParent("t1");
    expect(Object.keys(lastCall().data)).not.toContain("useRequestedAt");
  });

  it("updateMany の BatchPayload の count をそのまま返す（成功）", async () => {
    mockPrisma.treasureLog.updateMany.mockResolvedValue({ count: 1 });
    await expect(useTreasureByParent("t1")).resolves.toEqual({ count: 1 });
  });

  it("count=0（レース負け）もそのまま返し、例外は投げない", async () => {
    mockPrisma.treasureLog.updateMany.mockResolvedValue({ count: 0 });
    await expect(useTreasureByParent("t1")).resolves.toEqual({ count: 0 });
  });
});

describe("既存関数の契約は変えない（回帰・#164）", () => {
  it("approveTreasureUse は USE_REQUESTED 専用のまま", async () => {
    await approveTreasureUse("t1");
    expect(lastCall().where.useStatus).toBe("USE_REQUESTED");
  });

  it("autoApproveStaleTreasureUses は USE_REQUESTED のみ対象（既に USED の行を上書きしない）", async () => {
    await autoApproveStaleTreasureUses(new Date("2026-05-29T00:00:00Z"));
    expect(lastCall().where.useStatus).toBe("USE_REQUESTED");
  });
});
