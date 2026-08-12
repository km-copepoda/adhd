import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { routeLogger } from "@/lib/logger";
import { cleanupStaleCarryOverInstances } from "@/lib/quests";
import { jstDateOf } from "@/lib/date";

export async function GET() {
  const rlog = routeLogger("GET", "/api/approve/pending");
  const user = await getCurrentUser();
  if (!user || user.role !== "PARENT" || !user.familyId) {
    return NextResponse.json([]);
  }

  // carryOver を後から ON にした際の stale REPORTED/PENDING を遅延クリーンアップ
  const children = await prisma.user.findMany({
    where: { familyId: user.familyId, role: "CHILD" },
    select: { id: true },
  });
  for (const child of children) {
    const carryOverTemplates = await prisma.taskTemplate.findMany({
      where: {
        familyId: user.familyId,
        assignedChildId: child.id,
        isActive: true,
        carryOver: true,
      },
      select: { id: true, carryOver: true },
    });
    await cleanupStaleCarryOverInstances({ childId: child.id, templates: carryOverTemplates });
  }

  const quests = await prisma.questInstance.findMany({
    where: {
      OR: [{ status: "REPORTED" }, { status: "SKIP_REPORTED" }],
      template: { familyId: user.familyId },
    },
    include: {
      child: {
        select: { name: true, monsterName: true, side: true, reportDeadlineTime: true },
      },
      template: {
        select: { title: true, emoji: true, category: true, isTemporary: true, photoBonus: true },
      },
    },
    orderBy: { reportedAt: "desc" },
  });

  // 承認時の「今日やる宣言」ボーナス (+1XP) を表示にも反映するため、
  // 各 REPORTED クエストの (templateId, childId, reportedAt の JST 日付) で
  // QuestDeclaration をルックアップする。approveQuestInstance と同じ
  // 照合キーを使い、親が見る +Xpt と実際の付与額を一致させる。
  const declarationKeys = quests
    .filter((q): q is typeof q & { reportedAt: Date } => q.reportedAt != null)
    .map((q) => ({
      templateId: q.templateId,
      childId: q.childId,
      date: jstDateOf(q.reportedAt),
    }));

  let declaredSet = new Set<string>();
  if (declarationKeys.length > 0) {
    const declarations = await prisma.questDeclaration.findMany({
      where: { OR: declarationKeys },
      select: { templateId: true, childId: true, date: true },
    });
    declaredSet = new Set(
      declarations.map((d: { templateId: string; childId: string; date: Date }) =>
        `${d.templateId}|${d.childId}|${d.date.toISOString()}`,
      ),
    );
  }

  const enriched = quests.map((q) => {
    const declaredToday = q.reportedAt
      ? declaredSet.has(`${q.templateId}|${q.childId}|${jstDateOf(q.reportedAt).toISOString()}`)
      : false;
    return { ...q, declaredToday };
  });

  rlog.info("Pending approvals fetched", { userId: user.id, familyId: user.familyId, count: quests.length });
  return NextResponse.json(enriched);
}
