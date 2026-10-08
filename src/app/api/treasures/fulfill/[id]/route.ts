// #151: ごほうび使用を親承認フロー化する — このルートは「承認済み(USED)の巻き戻し専用」に一本化。
//
// POST /api/treasures/fulfill/[id]
//
// 旧仕様（fulfilled を任意の boolean にトグルできた）は廃止。
// USED -> UNUSED の巻き戻しのみを許可する（PARENT only）。
// #171: 保持期間（30日）を過ぎたごほうびは取り消し不可（400）。
// USE_REQUESTED や UNUSED からの巻き戻しは 400（承認/却下は /api/approve/[id] 側の責務）。

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { routeLogger } from "@/lib/logger";
import { canRevokeUse } from "@/lib/treasureUse";
import { revokeTreasureUse } from "@/lib/approve";
import { isWithinTreasureHistoryWindow } from "@/lib/treasureHistory";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const rlog = routeLogger("POST", "/api/treasures/fulfill/[id]");
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }
  if (user.role !== "PARENT" || !user.familyId) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const { id } = await params;

  // 同 family の TreasureLog のみ対象 (family スコープで他家庭の操作を防ぐ)
  const log = await prisma.treasureLog.findFirst({
    where: { id, child: { familyId: user.familyId } },
    select: { id: true, itemId: true, useStatus: true, openedAt: true },
  });
  if (!log) {
    return NextResponse.json({ error: "対象が見つかりません" }, { status: 404 });
  }

  // コレクション獲得行 (itemId=null) は実物受け渡しの概念が無いので不可
  if (log.itemId === null) {
    return NextResponse.json(
      { error: "コレクション獲得には受け渡しチェックは不要です" },
      { status: 400 },
    );
  }

  // 保持期間を過ぎたごほうびは親でも取り消せない（子の履歴から消えた状態を変えない）
  if (!isWithinTreasureHistoryWindow(log.openedAt, new Date())) {
    return NextResponse.json(
      { error: "保持期間を過ぎたごほうびは取り消せません" },
      { status: 400 },
    );
  }

  if (!canRevokeUse(log.useStatus)) {
    return NextResponse.json(
      { error: "承認済みのごほうびのみ取り消せます" },
      { status: 400 },
    );
  }

  const { count } = await revokeTreasureUse(id);
  if (count === 0) {
    return NextResponse.json({ error: "この状態からは取り消せません" }, { status: 400 });
  }

  rlog.info("Treasure use revoked", { logId: id, parentId: user.id });
  return NextResponse.json({ ok: true, id, useStatus: "UNUSED", fulfilled: false });
}
