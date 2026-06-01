// 親用 — 子供がもらった「ごほうび履歴」一覧
//
// GET /api/treasures/pending
//
// 2026-05-31: fulfilled (親メモ) フィールドを復活。同日 MVP フィードバック
// 「子が『もらってない』親が『あげた』」の水掛け論への防衛策として、
// 親 only の「渡したよチェック」を提供する。子画面には fulfilled を露出しない。
// POST /api/treasures/fulfill/[id] で更新する。

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { routeLogger } from "@/lib/logger";

const HISTORY_LIMIT = 100;

export async function GET() {
  const rlog = routeLogger("GET", "/api/treasures/pending");
  const user = await getCurrentUser();
  if (!user || user.role !== "PARENT") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  if (!user.familyId) {
    return NextResponse.json({ items: [] });
  }

  const items = await prisma.treasureLog.findMany({
    where: {
      status: "OPENED",
      itemId: { not: null },
      child: { familyId: user.familyId },
    },
    orderBy: { openedAt: "desc" },
    take: HISTORY_LIMIT,
    include: {
      item: { select: { id: true, title: true, rarity: true } },
      child: { select: { id: true, name: true, monsterName: true } },
    },
  });

  rlog.info("Treasure history fetched", { parentId: user.id, count: items.length });
  return NextResponse.json({
    items: items.map((i) => ({
      id: i.id,
      openedAt: i.openedAt,
      item: i.item,
      child: i.child,
      fulfilled: i.fulfilled,
    })),
  });
}
