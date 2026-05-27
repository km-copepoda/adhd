// 親用 — 未受け渡しの宝箱（当たりだがまだ渡していない）一覧
//
// GET /api/treasures/pending

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { routeLogger } from "@/lib/logger";

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
      fulfilled: false,
      itemId: { not: null },
      child: { familyId: user.familyId },
    },
    orderBy: { openedAt: "asc" },
    include: {
      item: { select: { id: true, title: true, rarity: true } },
      child: { select: { id: true, name: true, monsterName: true } },
    },
  });

  rlog.info("Pending treasures fetched", { parentId: user.id, count: items.length });
  return NextResponse.json({
    items: items.map((i) => ({
      id: i.id,
      openedAt: i.openedAt,
      item: i.item,
      child: i.child,
    })),
  });
}
