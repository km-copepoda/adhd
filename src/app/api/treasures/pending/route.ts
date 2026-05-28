// 親用 — 子供がもらった「ごほうび履歴」一覧
//
// GET /api/treasures/pending
//
// NOTE: エンドポイント名は「pending」のままだが、2026-05-28 B 決定により
// 「渡したよ」フローは廃止された。親は履歴として把握するだけで、確定操作は無い
// （実際のごほうび受け渡しは親子のリアルなコミュニケーションに任せる）。

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
    })),
  });
}
