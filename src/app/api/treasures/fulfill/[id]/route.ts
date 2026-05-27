// 親用 — 当たり宝箱の「渡したよ」確定
//
// POST /api/treasures/fulfill/[id]

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { routeLogger } from "@/lib/logger";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const rlog = routeLogger("POST", "/api/treasures/fulfill/[id]");
  const user = await getCurrentUser();
  if (!user || user.role !== "PARENT") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }
  if (!user.familyId) {
    return NextResponse.json({ error: "家族設定がありません" }, { status: 400 });
  }

  const { id } = await params;
  const log = await prisma.treasureLog.findFirst({
    where: { id, child: { familyId: user.familyId } },
    select: { id: true, status: true, itemId: true, fulfilled: true },
  });
  if (!log) {
    return NextResponse.json({ error: "宝箱が見つかりません" }, { status: 404 });
  }
  if (log.status !== "OPENED" || log.itemId === null) {
    return NextResponse.json({ error: "渡せる宝箱ではありません" }, { status: 400 });
  }
  if (log.fulfilled) {
    return NextResponse.json({ ok: true, alreadyFulfilled: true });
  }

  await prisma.treasureLog.update({
    where: { id },
    data: { fulfilled: true },
  });

  rlog.info("Treasure fulfilled", { parentId: user.id, logId: id });
  return NextResponse.json({ ok: true });
}
