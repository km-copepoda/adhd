// #151: 子が「ごほうびを使う」申請を出す専用ルート（親承認フローの起点）。
//
// POST /api/child/treasures/use-request/[id]
//
// 子専用。UNUSED -> USE_REQUESTED のみを許可する。
// 旧 POST /api/child/treasures/fulfill/[id]（子がトグルできた旧仕様）は廃止済み。
// 子から USE_REQUESTED / USED を巻き戻す API は存在しない（キャンセル不可）。

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { routeLogger } from "@/lib/logger";
import { canRequestUse } from "@/lib/treasureUse";
import { isWithinTreasureHistoryWindow } from "@/lib/treasureHistory";
import { sendPushToParent } from "@/lib/push";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const rlog = routeLogger("POST", "/api/child/treasures/use-request/[id]");
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }
  if (user.role !== "CHILD") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const { id } = await params;

  // 自分の TreasureLog のみ対象（childId スコープで他人・他家庭を弾く → 見つからなければ 404）
  const log = await prisma.treasureLog.findFirst({
    where: { id, childId: user.id },
    select: { id: true, itemId: true, status: true, openedAt: true, useStatus: true },
  });
  if (!log) {
    return NextResponse.json({ error: "対象が見つかりません" }, { status: 404 });
  }

  // コレクション当選行（itemId=null）は使用申請の概念が無い
  if (log.itemId === null) {
    return NextResponse.json(
      { error: "コレクション獲得には使用申請は不要です" },
      { status: 400 },
    );
  }

  // OPENED 以外（LOCKED / UNLOCKED / CANCELLED）は申請できない
  if (log.status !== "OPENED") {
    return NextResponse.json(
      { error: "あけたごほうびだけ申請できます" },
      { status: 400 },
    );
  }

  // 保持期間（TREASURE_HISTORY_RETENTION_DAYS 日）外は子画面に出ないので申請させない（API 直叩き防御）
  if (!isWithinTreasureHistoryWindow(log.openedAt, new Date())) {
    return NextResponse.json(
      { error: "この宝箱はもう表示期間が過ぎています" },
      { status: 400 },
    );
  }

  if (!canRequestUse(log.useStatus)) {
    return NextResponse.json(
      { error: "この状態からは申請できません" },
      { status: 400 },
    );
  }

  const now = new Date();

  // 条件付き updateMany（TOCTOU 対策）: where に現在の useStatus を含め、
  // 承認/却下と競合した場合は 0 件更新になるようにする。
  const { count } = await prisma.treasureLog.updateMany({
    where: { id, useStatus: "UNUSED" },
    data: { useStatus: "USE_REQUESTED", useRequestedAt: now },
  });
  if (count === 0) {
    return NextResponse.json({ error: "この状態からは申請できません" }, { status: 400 });
  }

  // 親へ通知（ベストエフォート。失敗しても申請自体は成功扱い）
  if (user.familyId) {
    try {
      const parent = await prisma.user.findFirst({
        where: { familyId: user.familyId, role: "PARENT" },
      });
      if (parent) {
        const childName = user.monsterName ?? user.name ?? "子供";
        await sendPushToParent(parent.id, {
          title: "🎁 ごほうび使用申請",
          body: `${childName}がごほうびの使用を申請しました`,
          url: "/app/parent/approve",
        });
      }
    } catch (err) {
      rlog.error("Push notification failed", { logId: id, err });
    }
  }

  rlog.info("Treasure use requested", { logId: id, childId: user.id });
  return NextResponse.json({ ok: true, id, useStatus: "USE_REQUESTED", fulfilled: false });
}
