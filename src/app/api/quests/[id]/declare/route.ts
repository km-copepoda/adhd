import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { todayJST } from "@/lib/date";
import { getMissedExposureCount, isEligibleForDeclaration } from "@/lib/declaration";
import { routeLogger } from "@/lib/logger";

// 直近の APPROVED より前のインスタンスは判定に使わない。
// 週次 + 数十週ぶんあれば十分なので 30 件で打ち切り。
const INSTANCE_LOOKBACK_LIMIT = 30;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const rlog = routeLogger("POST", "/api/quests/[id]/declare");
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }
  if (user.role !== "CHILD") {
    return NextResponse.json({ error: "子供のみ宣言できます" }, { status: 403 });
  }

  const { id } = await params;

  const quest = await prisma.questInstance.findUnique({
    where: { id, childId: user.id },
    include: { template: { select: { carryOver: true } } },
  });

  if (!quest) {
    return NextResponse.json({ error: "クエストが見つかりません" }, { status: 404 });
  }

  // 直近の N 件を date 降順で取って連鎖長を計算
  const allInstances = await prisma.questInstance.findMany({
    where: { templateId: quest.templateId, childId: user.id },
    orderBy: { date: "desc" },
    take: INSTANCE_LOOKBACK_LIMIT,
    select: { date: true, status: true },
  });

  const today = todayJST();
  const missedExposures = getMissedExposureCount({
    allInstances,
    today,
    carryOver: !!quest.template.carryOver,
  });

  if (!isEligibleForDeclaration({ missedExposures, status: quest.status })) {
    return NextResponse.json(
      { error: "宣言できる対象タスクではありません" },
      { status: 400 },
    );
  }

  await prisma.questDeclaration.upsert({
    where: {
      templateId_childId_date: {
        templateId: quest.templateId,
        childId: user.id,
        date: today,
      },
    },
    create: {
      templateId: quest.templateId,
      childId: user.id,
      date: today,
    },
    update: {},
  });

  rlog.info("Declaration recorded", { questId: id, childId: user.id, missedExposures });
  return NextResponse.json({ ok: true });
}
