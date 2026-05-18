import { NextResponse, after } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { resolveTargetChild } from "@/lib/parentChildView";
import { triggerMonsterRebornLog } from "@/lib/bulletinLog";
import { routeLogger } from "@/lib/logger";

/**
 * 親モードから子供の転生を代理実行する。
 *
 * decisions.md 2026-04-04（手動転生＋卵選択ボーナス）の拡張:
 * - 子供端末を持たない家庭で rebirthPending=true 状態がスタックし、
 *   XP 加点・進化チェックが止まる問題を解消する
 * - 親代理転生は **常に NORMAL 卵（rebirthEggBonus=null）** を使う:
 *   卵選択は子供の体験/愛着形成のための儀式（2026-04-04）なので、
 *   親が代わりに「STUDY を選んでおく」等の創造的判断をしない
 */
export async function POST(request: Request) {
  const rlog = routeLogger("POST", "/api/parent/child-view/rebirth");
  const parent = await getCurrentUser();
  if (!parent) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const body = await request.json();
  const { childId } = body ?? {};

  const resolved = await resolveTargetChild(parent, childId);
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }
  const child = resolved.child as any;

  if (!child.rebirthPending) {
    return NextResponse.json({ error: "転生の準備ができていません" }, { status: 400 });
  }

  // NORMAL 卵はボーナス無し・使用済み記録もしない（usedEggBonuses はそのまま）
  // TOCTOU 回避: rebirthPending=true を WHERE 条件に含めて、別経路（子供本人）で
  // 先に転生済みなら count=0 となり 400 を返す（子供の卵選択を上書きしない）。
  const result = await prisma.user.updateMany({
    where: { id: child.id, rebirthPending: true },
    data: {
      rebirthPending: false,
      rebirthEggBonus: null,
      evolutionStage: 0,
      evolutionPath: "",
      studyPt: 0,
      staminaPt: 0,
      lifePt: 0,
    },
  });
  if (result.count === 0) {
    return NextResponse.json({ error: "転生の準備ができていません" }, { status: 400 });
  }

  after(() => triggerMonsterRebornLog(child.id, "ふつう").catch(() => {}));

  rlog.info("Parent rebirth-on-behalf executed", {
    childId: child.id,
    parentId: parent.id,
  });
  return NextResponse.json({ ok: true });
}
