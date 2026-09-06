// #72 — 子供が自分のごほうびの「つかった / つかってない」をトグルする子専用ルート。
//
// POST /api/child/treasures/fulfill/[id]  body: { fulfilled: boolean }
//
// 既存の親専用 POST /api/treasures/fulfill/[id]（PARENT only）とは別ルート。
// fulfilled カラムは共有だが由来は追わない（表示は ✅つかったよ / ⏳みつかってない の二値）。
// 子が操作できるのは「自分の・OPENED・実ごほうび当選・保持期間内」の行だけ。

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { routeLogger } from "@/lib/logger";
import { isWithinTreasureHistoryWindow } from "@/lib/treasureHistory";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const rlog = routeLogger("POST", "/api/child/treasures/fulfill/[id]");
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }
  if (user.role !== "CHILD") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { fulfilled?: unknown };
  if (typeof body.fulfilled !== "boolean") {
    return NextResponse.json(
      { error: "fulfilled は boolean で指定してください" },
      { status: 400 },
    );
  }

  const { id } = await params;

  // 自分の TreasureLog のみ対象（childId スコープで他人・他家庭を弾く → 見つからなければ 404）
  const log = await prisma.treasureLog.findFirst({
    where: { id, childId: user.id },
    select: { id: true, itemId: true, status: true, openedAt: true },
  });
  if (!log) {
    return NextResponse.json({ error: "対象が見つかりません" }, { status: 404 });
  }

  // コレクション当選行（itemId=null）は実物受け渡しの概念が無い
  if (log.itemId === null) {
    return NextResponse.json(
      { error: "コレクション獲得には使用チェックは不要です" },
      { status: 400 },
    );
  }

  // OPENED 以外（LOCKED / UNLOCKED / CANCELLED）は使用状態の概念なし
  if (log.status !== "OPENED") {
    return NextResponse.json(
      { error: "あけたごほうびだけ操作できます" },
      { status: 400 },
    );
  }

  // 保持期間（TREASURE_HISTORY_RETENTION_DAYS 日）外は子画面に出ないので操作させない（API 直叩き防御）
  if (!isWithinTreasureHistoryWindow(log.openedAt, new Date())) {
    return NextResponse.json(
      { error: "この宝箱はもう表示期間が過ぎています" },
      { status: 400 },
    );
  }

  const updated = await prisma.treasureLog.update({
    where: { id },
    data: { fulfilled: body.fulfilled },
    select: { id: true, fulfilled: true },
  });

  rlog.info("Child fulfill toggled", { logId: id, fulfilled: body.fulfilled, childId: user.id });
  return NextResponse.json({ ok: true, id: updated.id, fulfilled: updated.fulfilled });
}
