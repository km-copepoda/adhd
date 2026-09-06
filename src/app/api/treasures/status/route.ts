// 子供用 — 宝箱のストック表示と開封履歴
//
// GET /api/treasures/status
// 戻り値:
//   { locked: number, unlocked: number, hasPool: boolean,
//     opened: TreasureLogSummary[], rewards: TreasureRewardSummary[] }
// opened は「開封から TREASURE_HISTORY_RETENTION_DAYS（30日 / 1か月）以内」のみを返す。
// 古い宝箱の達成感を毎日眺めるよりも直近の体験を見せる方が UX が良いとの判断。
// rewards は同ウィンドウ内の「実ごほうび当選（itemId != null）」だけを、opened の
// 表示上限とは独立に、保持期間内は全件取得したもの。ごほうび一覧（在庫UI）は
// こちらを使う — 開封数に関わらず期間内の未使用ごほうびが一覧から欠落しない（#127）。
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

  const [locked, unlocked, opened, poolSize, rewards] = await Promise.all([
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
    // #127: ごほうび在庫は履歴上限（HISTORY_LIMIT）と独立に、保持期間（30日）内の
    // 実ごほうび当選（itemId != null）を全件取得する。件数は 30日ウィンドウで
    // 自然に頭打ちになるため take は掛けない（上限を掛けると溜め込み開封で
    // 期間内の未使用ごほうびが一覧から欠落し、この修正の意味が無くなる）。
    prisma.treasureLog.findMany({
      where: {
        childId: user.id,
        status: "OPENED",
        openedAt: { gte: cutoff },
        itemId: { not: null },
      },
      orderBy: { openedAt: "desc" },
      include: {
        item: { select: { id: true, title: true, rarity: true } },
      },
    }),
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
        // #72: 子向けにも使用状態を露出。コレクション当選行（item=null）は概念が無いので false 固定。
        fulfilled: o.item != null ? o.fulfilled : false,
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
    // #127: ごほうび一覧（在庫UI）専用。実ごほうび当選のみ・新しい順。
    rewards: rewards
      .filter((o) => o.item != null)
      .map((o) => ({
        id: o.id,
        openedAt: o.openedAt,
        boosted: o.boosted,
        item: o.item,
        fulfilled: o.fulfilled,
      })),
  });
}
