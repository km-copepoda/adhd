// 親代理（子供モード）— 宝箱を 1個開封する。
//
// POST /api/parent/child-view/treasures/open  body: { childId: string }
// 子供セルフ用の /api/treasures/open と異なり、親ごほうび当選時の親への Push は送らない
// （親自身が操作した結果なので二重通知になる）。
// 抽選そのものは openOldestTreasure を共用するため、抽選確率・天井・コレクション付与は同等。

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { openOldestTreasure } from "@/lib/treasureService";
import { resolveTargetChild } from "@/lib/parentChildView";

export async function POST(request: Request) {
  const parent = await getCurrentUser();
  if (!parent) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  let body: { childId?: string } = {};
  try {
    body = (await request.json()) as { childId?: string };
  } catch {
    body = {};
  }

  const resolved = await resolveTargetChild(parent, body.childId);
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }
  const child = resolved.child;

  const result = await openOldestTreasure(child.id);
  if (!result) {
    return NextResponse.json({ error: "開封できる宝箱がありません" }, { status: 400 });
  }

  const remainingUnlocked = await prisma.treasureLog.count({
    where: { childId: child.id, status: "UNLOCKED" },
  });

  return NextResponse.json({
    ok: true,
    pityTriggered: result.pityTriggered,
    item: result.item,
    collectionItem: result.collectionItem,
    remainingUnlocked,
  });
}
