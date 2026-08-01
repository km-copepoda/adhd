// 子供用 — 宝箱のストック表示と開封履歴
//
// GET /api/treasures/status
// 戻り値:
//   { locked: number, unlocked: number, hasPool: boolean, opened: TreasureLogSummary[] }
// opened は「開封から TREASURE_HISTORY_RETENTION_DAYS（1週間）以内」のみを返す。
// 古い宝箱の達成感を毎日眺めるよりも直近の体験を見せる方が UX が良いとの判断。
// hasPool は親がごほうびを設定しているかの情報用フィールド（将来の親向け案内に利用）。

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { routeLogger } from "@/lib/logger";
import { getTreasureHistoryCutoff } from "@/lib/treasureHistory";
import { getCollectionItemById } from "@/lib/collectionItems";

const HISTORY_LIMIT = 50;

export async function GET() {
  const rlog = routeLogger("GET", "/api/treasures/status");
  const user = await getCurrentUser();
  if (!user || user.role !== "CHILD") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const cutoff = getTreasureHistoryCutoff(new Date());

  const [locked, unlocked, opened, poolSize] = await Promise.all([
    prisma.treasureLog.count({ where: { childId: user.id, status: "LOCKED" } }),
    prisma.treasureLog.count({ where: { childId: user.id, status: "UNLOCKED" } }),
    prisma.treasureLog.findMany({
      where: {
        childId: user.id,
        status: "OPENED",
        openedAt: { gte: cutoff },
      },
      orderBy: { openedAt: "desc" },
      take: HISTORY_LIMIT,
      include: {
        item: { select: { id: true, title: true, rarity: true } },
      },
    }),
    prisma.treasureItem.count({ where: { childId: user.id, isActive: true } }),
  ]);

  rlog.info("Treasure status", { childId: user.id, locked, unlocked, opened: opened.length, poolSize });
  return NextResponse.json({
    locked,
    unlocked,
    hasPool: poolSize > 0,
    opened: opened.map((o) => {
      // 親ごほうび不当選時は collectionItemId からマスター情報を解決して履歴に表示
      const ci = o.collectionItemId ? getCollectionItemById(o.collectionItemId) : null;
      return {
        id: o.id,
        openedAt: o.openedAt,
        boosted: o.boosted,
        item: o.item, // null = 親ごほうび不当選
        collectionItem: ci
          ? {
              id: ci.id,
              name: ci.name,
              season: ci.season,
              rarity: ci.rarity,
              image: ci.image,
              month: ci.month,
            }
          : null,
      };
    }),
  });
}
