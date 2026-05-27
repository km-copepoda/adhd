// 親用 — 宝箱プールのテンプレート一括投入
// 設計セクション 12: 「おすすめセットで始める」

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { routeLogger } from "@/lib/logger";
import { TREASURE_TEMPLATES } from "@/lib/treasureTemplates";

export async function POST(request: Request) {
  const rlog = routeLogger("POST", "/api/treasures/import");
  const user = await getCurrentUser();
  if (!user || user.role !== "PARENT") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const childId = typeof body.childId === "string" ? body.childId : "";
  if (!childId) {
    return NextResponse.json({ error: "childId が必要です" }, { status: 400 });
  }

  const child = await prisma.user.findFirst({
    where: { id: childId, role: "CHILD", familyId: user.familyId ?? undefined },
    select: { id: true },
  });
  if (!child) {
    return NextResponse.json({ error: "対象の子供が見つかりません" }, { status: 404 });
  }

  const created = await prisma.treasureItem.createMany({
    data: TREASURE_TEMPLATES.map((t, i) => ({
      childId,
      title: t.title,
      rarity: t.rarity,
      sortOrder: i,
    })),
  });

  rlog.info("Treasure templates imported", { parentId: user.id, childId, count: created.count });
  return NextResponse.json({ ok: true, count: created.count });
}
