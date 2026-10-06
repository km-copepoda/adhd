// #164: 親が承認なしで直接ごほうびを「使用済み」にする専用ルート。
//
// POST /api/treasures/use/[id]
//
// PARENT 専用。UNUSED | USE_REQUESTED -> USED。子への Push は送らない。
// fulfill/[id]（USED の巻き戻し専用）とは別ルート。XP / 進化 / ストリーク / バッジは呼ばない。

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { routeLogger } from "@/lib/logger";
import { canUseByParent } from "@/lib/treasureUse";
import { isWithinTreasureHistoryWindow } from "@/lib/treasureHistory";
import { useTreasureByParent as markTreasureUsedByParent } from "@/lib/approve";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const rlog = routeLogger("POST", "/api/treasures/use/[id]");
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }
  if (user.role !== "PARENT" || !user.familyId) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const { id } = await params;

  // 同 family の TreasureLog のみ対象（他家庭は 404）
  const log = await prisma.treasureLog.findFirst({
    where: { id, child: { familyId: user.familyId } },
    select: { id: true, itemId: true, status: true, openedAt: true, useStatus: true },
  });
  if (!log) {
    return NextResponse.json({ error: "対象が見つかりません" }, { status: 404 });
  }

  // コレクション獲得行（itemId=null）は使用の概念が無い
  if (log.itemId === null) {
    return NextResponse.json(
      { error: "コレクション獲得には使用操作は不要です" },
      { status: 400 },
    );
  }

  if (log.status !== "OPENED") {
    return NextResponse.json(
      { error: "あけたごほうびだけ使用済みにできます" },
      { status: 400 },
    );
  }

  // 保持期間外は子画面に出ないので使用不可（子の申請 API と同じ扱い）
  if (!isWithinTreasureHistoryWindow(log.openedAt, new Date())) {
    return NextResponse.json(
      { error: "この宝箱はもう表示期間が過ぎています" },
      { status: 400 },
    );
  }

  if (!canUseByParent(log.useStatus)) {
    return NextResponse.json(
      { error: "この状態からは使用済みにできません" },
      { status: 400 },
    );
  }

  const { count } = await markTreasureUsedByParent(id);
  if (count === 0) {
    return NextResponse.json(
      { error: "この状態からは使用済みにできません" },
      { status: 400 },
    );
  }

  rlog.info("Treasure used by parent", { logId: id, parentId: user.id });
  return NextResponse.json({ ok: true, id, useStatus: "USED", fulfilled: true });
}
