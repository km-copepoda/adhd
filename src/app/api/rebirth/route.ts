import { NextResponse, after } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { triggerMonsterRebornLog } from "@/lib/bulletinLog";

const VALID_EGG_TYPES = ["NORMAL", "STUDY", "STAMINA", "LIFE"] as const;

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }
  if (user.role !== "CHILD") {
    return NextResponse.json({ error: "子供のみ操作可能です" }, { status: 403 });
  }

  const body = await request.json();
  const { eggType } = body;

  if (!VALID_EGG_TYPES.includes(eggType)) {
    return NextResponse.json({ error: "無効な卵タイプです" }, { status: 400 });
  }

  const child = await prisma.user.findUnique({
    where: { id: user.id },
    select: { rebirthPending: true, usedEggBonuses: true },
  });

  if (!child?.rebirthPending) {
    return NextResponse.json({ error: "転生の準備ができていません" }, { status: 400 });
  }

  const prevUsed = JSON.parse(child.usedEggBonuses ?? "[]") as string[];
  const newUsed = eggType !== "NORMAL" && !prevUsed.includes(eggType)
    ? [...prevUsed, eggType]
    : prevUsed;

  // TOCTOU 回避: rebirthPending=true を WHERE 条件に含めて、別経路（親代理転生・別端末）で
  // 先に転生済みなら count=0 となり 400 を返す。
  const result = await prisma.user.updateMany({
    where: { id: user.id, rebirthPending: true },
    data: {
      rebirthPending: false,
      rebirthEggBonus: eggType === "NORMAL" ? null : eggType,
      evolutionStage: 0,
      evolutionPath: "",
      studyPt: 0,
      staminaPt: 0,
      lifePt: 0,
      usedEggBonuses: JSON.stringify(newUsed),
    },
  });
  if (result.count === 0) {
    return NextResponse.json({ error: "転生の準備ができていません" }, { status: 400 });
  }

  // 転生ログ — after() でレスポンス送信後に実行（サーバレスで取りこぼさないため）
  const eggLabel: Record<string, string> = { NORMAL: "ふつう", STUDY: "べんきょう", STAMINA: "たいりょく", LIFE: "せいかつ" };
  after(() => triggerMonsterRebornLog(user.id, eggLabel[eggType] ?? eggType).catch(() => {}));

  return NextResponse.json({ ok: true });
}
