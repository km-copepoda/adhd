// loadBadgeContext の「コレクションアイテムのシーズン制覇 / 全制覇判定は
// 通常アイテム (month === undefined) だけを母数にする」フィルタ挙動の担保。
//
// 2026-07-21 に月限定アイテム 60 種が追加されて母数が 140 に増えたため、
// 何もしないと season_complete が 35種、item_80_all が 140種を要求するように
// 暴騰する。バッジ判定は「通常アイテムのみ」を対象にする方針を採用。
//
// 仕様: docs/未実装仕様書/monthly-limited-collection-items.md §7

import { describe, it, expect, vi, beforeEach } from "vitest";
import { loadBadgeContext } from "@/lib/badges";
import { ALL_COLLECTION_ITEMS } from "@/lib/collectionItems";
import { prismaMock as mockPrisma } from "../helpers/prisma-mock";
import { childUser, userCollectionItem } from "../helpers/fixtures";

function mockPrismaBaseline() {
  mockPrisma.user.findUnique.mockResolvedValue(
    childUser({
      evolutionStage: 1,
      collectedPaths: "[]",
      studyPt: 0,
      staminaPt: 0,
      lifePt: 0,
      usedEggBonuses: "[]",
    }),
  );
  mockPrisma.streak.findUnique.mockResolvedValue(null);
  mockPrisma.questInstance.findMany.mockResolvedValue([]);
  // taskStreak.findMany はグローバル setup ではデフォルト値が設定されていないので、その場で追加する
  mockPrisma.taskStreak.findMany.mockResolvedValue([]);
  mockPrisma.taskTemplate.count.mockResolvedValue(0);
  mockPrisma.userBadge.count.mockResolvedValue(0);
  mockPrisma.treasureLog.findMany.mockResolvedValue([]);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPrismaBaseline();
});

describe("loadBadgeContext: 通常アイテム 80 種で判定する", () => {
  it("通常アイテム 20/20 が揃えば summer は制覇済み扱い（月限定は含めない）", async () => {
    const regularSummer = ALL_COLLECTION_ITEMS.filter(
      (i) => i.season === "summer" && i.month === undefined,
    );
    expect(regularSummer).toHaveLength(20);

    mockPrisma.userCollectionItem.findMany.mockResolvedValue(
      regularSummer.map((i) => userCollectionItem({ itemId: i.id, season: "summer" })),
    );

    const ctx = await loadBadgeContext("c1");
    expect(ctx.collectionSeasonsComplete).toBe(1);
  });

  it("通常アイテムが 19/20 だと未達（月限定を持っていても補完されない）", async () => {
    const regularSummer = ALL_COLLECTION_ITEMS.filter(
      (i) => i.season === "summer" && i.month === undefined,
    );
    const owned = regularSummer.slice(0, 19); // 1つ抜け
    // 加えて月限定アイテムを大量に所持していても意味がない
    const monthly7 = ALL_COLLECTION_ITEMS.filter((i) => i.month === 7);

    mockPrisma.userCollectionItem.findMany.mockResolvedValue(
      [...owned, ...monthly7].map((i) => userCollectionItem({ itemId: i.id, season: i.season })),
    );

    const ctx = await loadBadgeContext("c1");
    expect(ctx.collectionSeasonsComplete).toBe(0);
  });

  it("通常アイテム 80 種を全部揃えると hasAllCollectionItems=true (月限定は無関係)", async () => {
    const regularAll = ALL_COLLECTION_ITEMS.filter((i) => i.month === undefined);
    expect(regularAll).toHaveLength(80);

    mockPrisma.userCollectionItem.findMany.mockResolvedValue(
      regularAll.map((i) => userCollectionItem({ itemId: i.id, season: i.season })),
    );

    const ctx = await loadBadgeContext("c1");
    expect(ctx.hasAllCollectionItems).toBe(true);
    expect(ctx.collectionSeasonsComplete).toBe(4);
  });

  it("通常 79 + 月限定 60 でも hasAllCollectionItems=false（母数は 80）", async () => {
    const regularAll = ALL_COLLECTION_ITEMS.filter((i) => i.month === undefined);
    const owned = regularAll.slice(0, 79); // 1つ抜け
    const monthlyAll = ALL_COLLECTION_ITEMS.filter((i) => i.month !== undefined);

    mockPrisma.userCollectionItem.findMany.mockResolvedValue(
      [...owned, ...monthlyAll].map((i) => userCollectionItem({ itemId: i.id, season: i.season })),
    );

    const ctx = await loadBadgeContext("c1");
    expect(ctx.hasAllCollectionItems).toBe(false);
  });

  it("collectionItemCount は月限定も含めた distinct 数を返す（累積カウント系はそのまま）", async () => {
    const regularAll = ALL_COLLECTION_ITEMS.filter((i) => i.month === undefined);
    const monthlyAll = ALL_COLLECTION_ITEMS.filter((i) => i.month !== undefined);
    const owned = [...regularAll, ...monthlyAll];

    mockPrisma.userCollectionItem.findMany.mockResolvedValue(
      owned.map((i) => userCollectionItem({ itemId: i.id, season: i.season })),
    );

    const ctx = await loadBadgeContext("c1");
    // 80 + 60 = 140
    expect(ctx.collectionItemCount).toBe(140);
  });
});
