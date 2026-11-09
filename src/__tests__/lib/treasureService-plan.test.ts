import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDeep } from "vitest-mock-extended";
import type { PrismaClient } from "@/generated/prisma/client";
import { openOldestTreasure } from "@/lib/treasureService";
import { prismaMock as mockPrisma } from "../helpers/prisma-mock";
import { treasureLog, childUser, parentUser, subscription, userCollectionItem } from "../helpers/fixtures";

vi.mock("@/lib/bulletinLog", () => ({
  triggerCollectionItemLog: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.user.update.mockResolvedValue(childUser());
  mockPrisma.userCollectionItem.upsert.mockResolvedValue(userCollectionItem({ count: 1 }));
  mockPrisma.treasureLog.update.mockResolvedValue(treasureLog());
  mockPrisma.treasureLog.updateMany.mockResolvedValue({ count: 1 });
});

/// FREE プランは季節コレクション (通常 80 種) からのドロップを受けず、月限定 (5 種) のみが対象。
/// 仕様: docs/未実装仕様書/monetization-plan.md §2.5 / §4.4
describe("openOldestTreasure — FREE プランのコレクションプール制限", () => {
  const jstJul15 = new Date("2026-07-15T03:00:00Z"); // 7月 → summer, m07-xx

  function primeMissDraw() {
    // MISS 抽選: 親プール空 or rng=0.99 (COMMON 割合最下位) で外し、コレクション付与経路へ
    mockPrisma.treasureLog.findFirst.mockResolvedValue(
      treasureLog({ id: "log-1", childId: "c1", boosted: false }),
    );
    mockPrisma.treasureItem.findMany.mockResolvedValue([]); // 親プール空 → MISS 確定
  }

  it("FREE (親 Subscription なし) は 月限定 m07-* からのみドロップ", async () => {
    primeMissDraw();
    mockPrisma.user.findUnique.mockResolvedValue(
      childUser({ treasurePityCount: 0, familyId: "fam-1" }),
    );
    mockPrisma.user.findFirst.mockResolvedValue(parentUser({ id: "parent-1" })); // getFamilyPlan
    mockPrisma.subscription.findUnique.mockResolvedValue(null); // FREE

    const result = await openOldestTreasure("c1", { now: jstJul15 });

    expect(result?.collectionItem?.id).toMatch(/^m07-\d+$/);
    // 通常シーズン summer-XX は選ばれない
    expect(result?.collectionItem?.id).not.toMatch(/^summer-/);
  });

  it("PREMIUM は summer-XX / m07-XX の両方が対象 (rng で片方に固定できる)", async () => {
    primeMissDraw();
    mockPrisma.user.findUnique.mockResolvedValue(
      childUser({ treasurePityCount: 0, familyId: "fam-1" }),
    );
    mockPrisma.user.findFirst.mockResolvedValue(parentUser({ id: "parent-1" }));
    mockPrisma.subscription.findUnique.mockResolvedValue(
      subscription({ plan: "PREMIUM", currentPeriodEnd: new Date("2099-12-31") }),
    );

    // rng=0.5 → COMMON レア域、プール順の先頭 (summer-* が先) から選ばれる
    const result = await openOldestTreasure("c1", { now: jstJul15, rng: () => 0.5 });

    // summer-XX または m07-XX (通常プールが有効)
    expect(result?.collectionItem?.id).toMatch(/^(summer-\d+|m07-\d+)$/);
    // PREMIUM プールには通常シーズンが含まれる
    // (rng 固定で summer-* が優先選択される)
    expect(result?.collectionItem?.id).toMatch(/^summer-/);
  });

  it("familyId=null (単独モード) は全プール = PREMIUM 同等 (既存挙動を維持)", async () => {
    primeMissDraw();
    mockPrisma.user.findUnique.mockResolvedValue(
      childUser({ treasurePityCount: 0, familyId: null }),
    );

    const result = await openOldestTreasure("c1", { now: jstJul15, rng: () => 0.5 });

    // 単独モードは getFamilyPlan を呼ばない
    expect(mockPrisma.user.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.subscription.findUnique).not.toHaveBeenCalled();
    // summer-* も含めて全プールから選ばれる (rng=0.5 で summer-* が優先)
    expect(result?.collectionItem?.id).toMatch(/^(summer-\d+|m07-\d+)$/);
  });

  it("FREE + 全 rng ドロー: 常に月限定 m07-* のみ", async () => {
    primeMissDraw();
    mockPrisma.user.findUnique.mockResolvedValue(
      childUser({ treasurePityCount: 0, familyId: "fam-1" }),
    );
    mockPrisma.user.findFirst.mockResolvedValue(parentUser({ id: "parent-1" }));
    mockPrisma.subscription.findUnique.mockResolvedValue(null);

    // 複数の rng でも常に m07- しか出ないこと
    for (const rng of [0.0, 0.1, 0.4, 0.9, 0.99]) {
      // upsert / log update は複数回呼ばれても OK なので、必要な mock を再セット
      mockPrisma.treasureLog.findFirst.mockResolvedValue(
        treasureLog({ id: "log-x", childId: "c1", boosted: false }),
      );
      const result = await openOldestTreasure("c1", { now: jstJul15, rng: () => rng });
      expect(result?.collectionItem?.id).toMatch(/^m07-\d+$/);
    }
  });
});

/// Codex 指摘: openOldestTreasure の interactive transaction 内で getFamilyPlan がルートの prisma を使うと
/// 接続プール枯渇時に開封がタイムアウトしうる。tx を渡して同一コネクションで読む。
describe("openOldestTreasure — getFamilyPlan は tx 経由", () => {
  it("プール未当選かつ familyId ありのとき、親/Subscription の読み取りは tx 経由でルート prisma は使わない", async () => {
    const tx = mockDeep<PrismaClient>();
    tx.treasureLog.updateMany.mockResolvedValue({ count: 1 });
    tx.treasureLog.update.mockResolvedValue(treasureLog());
    tx.treasureItem.findMany.mockResolvedValue([]); // 親プール空 → MISS
    tx.user.findUnique.mockResolvedValue(childUser({ treasurePityCount: 0, familyId: "fam-1" }));
    tx.user.update.mockResolvedValue(childUser());
    tx.user.findFirst.mockResolvedValue(parentUser({ id: "parent-1" }));
    tx.subscription.findUnique.mockResolvedValue(null);
    tx.userCollectionItem.findMany.mockResolvedValue([]);
    tx.userCollectionItem.upsert.mockResolvedValue(userCollectionItem({ count: 1 }));

    mockPrisma.treasureLog.findFirst.mockResolvedValue(
      treasureLog({ id: "log-1", childId: "c1", boosted: false }),
    );
    (mockPrisma.$transaction as unknown as { mockImplementationOnce: (fn: (cb: unknown) => unknown) => void })
      .mockImplementationOnce((cb) => (cb as (t: unknown) => Promise<unknown>)(tx));

    await openOldestTreasure("c1", { now: new Date("2026-07-15T03:00:00Z") });

    expect(tx.user.findFirst).toHaveBeenCalledWith({
      where: { familyId: "fam-1", role: "PARENT" },
      select: { id: true },
    });
    expect(tx.subscription.findUnique).toHaveBeenCalled();
    expect(mockPrisma.user.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.subscription.findUnique).not.toHaveBeenCalled();
  });
});
