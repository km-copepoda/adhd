// 親用 — ごほうび受け渡し記録のチェック / 取り消し
//
// POST /api/treasures/fulfill/[id]  body: { fulfilled: boolean }
//
// 親 only の「渡したよチェック」。子画面には露出させない（水掛け論防衛用の親メモ）。
// 親ごほうび当選 (itemId not null) の TreasureLog のみ対象。
// コレクション獲得行 (itemId=null) は実物受け渡しが無いので 400。
//
// 2026-05-31: 2026-05-28 で廃止した fulfilled フラグを復活させた。
// MVP で「子が『もらってない』親が『あげた』」の水掛け論が観測されたため。

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { routeLogger } from "@/lib/logger";

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

  const body = (await request.json().catch(() => ({}))) as { fulfilled?: unknown };
  if (typeof body.fulfilled !== "boolean") {
    return NextResponse.json({ error: "fulfilled は boolean で指定してください" }, { status: 400 });
  }

  const { id } = await params;

  // 同 family の TreasureLog のみ対象 (family スコープで他家庭の操作を防ぐ)
  const log = await prisma.treasureLog.findFirst({
    where: { id, child: { familyId: user.familyId } },
    select: { id: true, itemId: true },
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

  const updated = await prisma.treasureLog.update({
    where: { id },
    data: { fulfilled: body.fulfilled },
    select: { id: true, fulfilled: true },
  });

  rlog.info("Fulfill toggled", { logId: id, fulfilled: body.fulfilled, parentId: user.id });
  return NextResponse.json({ ok: true, id: updated.id, fulfilled: updated.fulfilled });
}
