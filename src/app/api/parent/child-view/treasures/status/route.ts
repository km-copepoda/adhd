// 親代理（子供モード）— 宝箱のストックと開封履歴を子供分閲覧する。
//
// GET /api/parent/child-view/treasures/status?childId=X
// 既存 /api/treasures/status を子供セルフ用にしたまま、親モード経路として並走させる。
// 履歴の 7日制限・hasPool 判定は子画面と同じ（親モードは子画面の延長として扱う）。

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { resolveTargetChild } from "@/lib/parentChildView";
import { getTreasureHistoryCutoff } from "@/lib/treasureHistory";
import { getCollectionItemById } from "@/lib/collectionItems";

const HISTORY_LIMIT = 50;

export async function GET(request: Request) {
  const parent = await getCurrentUser();
  if (!parent) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const url = new URL(request.url);
  const childId = url.searchParams.get("childId");
  const resolved = await resolveTargetChild(parent, childId);
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }
  const child = resolved.child;

  const cutoff = getTreasureHistoryCutoff(new Date());

  const [locked, unlocked, opened, poolSize] = await Promise.all([
    prisma.treasureLog.count({ where: { childId: child.id, status: "LOCKED" } }),
    prisma.treasureLog.count({ where: { childId: child.id, status: "UNLOCKED" } }),
    prisma.treasureLog.findMany({
      where: {
        childId: child.id,
        status: "OPENED",
        openedAt: { gte: cutoff },
      },
      orderBy: { openedAt: "desc" },
      take: HISTORY_LIMIT,
      include: {
        item: { select: { id: true, title: true, rarity: true } },
      },
    }),
    prisma.treasureItem.count({ where: { childId: child.id, isActive: true } }),
  ]);

  return NextResponse.json({
    locked,
    unlocked,
    hasPool: poolSize > 0,
    opened: opened.map((o: any) => {
      const ci = o.collectionItemId ? getCollectionItemById(o.collectionItemId) : null;
      return {
        id: o.id,
        openedAt: o.openedAt,
        boosted: o.boosted,
        item: o.item,
        collectionItem: ci
          ? { id: ci.id, name: ci.name, season: ci.season, rarity: ci.rarity, image: ci.image }
          : null,
      };
    }),
  });
}
