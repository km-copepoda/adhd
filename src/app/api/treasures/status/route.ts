// 子供用 — 宝箱のストック表示と開封履歴
//
// GET /api/treasures/status
// 戻り値:
//   { locked: number, unlocked: number, opened: TreasureLogSummary[] }
// opened は「開封から TREASURE_HISTORY_RETENTION_DAYS（1週間）以内」のみを返す。
// 古い宝箱の達成感を毎日眺めるよりも直近の体験を見せる方が UX が良いとの判断。

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { routeLogger } from "@/lib/logger";
import { getTreasureHistoryCutoff } from "@/lib/treasureHistory";

const HISTORY_LIMIT = 50;

export async function GET() {
  const rlog = routeLogger("GET", "/api/treasures/status");
  const user = await getCurrentUser();
  if (!user || user.role !== "CHILD") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const cutoff = getTreasureHistoryCutoff(new Date());

  const [locked, unlocked, opened] = await Promise.all([
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
  ]);

  rlog.info("Treasure status", { childId: user.id, locked, unlocked, opened: opened.length });
  return NextResponse.json({
    locked,
    unlocked,
    opened: opened.map((o) => ({
      id: o.id,
      openedAt: o.openedAt,
      boosted: o.boosted,
      item: o.item, // null = ハズレ
    })),
  });
}
