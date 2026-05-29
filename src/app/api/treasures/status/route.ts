// 子供用 — 宝箱のストック表示と開封履歴
//
// GET /api/treasures/status
// 戻り値:
//   { locked: number, unlocked: number, hasPool: boolean, opened: TreasureLogSummary[] }
// opened は「開封から TREASURE_HISTORY_RETENTION_DAYS（1週間）以内」のみを返す。
// hasPool は親が宝箱アイテムを 1件でも設定しているか。フッターの宝箱タブ表示判定で使う
// （未設定 & ログ無しの子供にはタブを出さない → UI ノイズ削減）。
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
    opened: opened.map((o) => ({
      id: o.id,
      openedAt: o.openedAt,
      boosted: o.boosted,
      item: o.item, // null = ハズレ
    })),
  });
}
