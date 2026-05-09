import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { todayJST } from "@/lib/date";
import { getIdleDays, isEligibleForDeclaration } from "@/lib/declaration";
import { routeLogger } from "@/lib/logger";

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
    include: { template: { select: { createdAt: true } } },
  });

  if (!quest) {
    return NextResponse.json({ error: "クエストが見つかりません" }, { status: 404 });
  }

  // 直近 APPROVED の approvedAt を取得して放置日数を算出
  const lastApproved = await prisma.questInstance.findFirst({
    where: {
      templateId: quest.templateId,
      childId: user.id,
      status: "APPROVED",
    },
    orderBy: { approvedAt: "desc" },
    select: { approvedAt: true },
  });

  const today = todayJST();
  const idleDays = getIdleDays({
    today,
    lastApprovedAt: lastApproved?.approvedAt ?? null,
    templateCreatedAt: quest.template.createdAt,
  });

  if (!isEligibleForDeclaration({ idleDays, status: quest.status })) {
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

  rlog.info("Declaration recorded", { questId: id, childId: user.id, idleDays });
  return NextResponse.json({ ok: true });
}
