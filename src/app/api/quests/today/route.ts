import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { todayJST } from "@/lib/date";
import { ensureTodayQuests } from "@/lib/quests";
import { getIdleDays } from "@/lib/declaration";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !user.familyId) {
    return NextResponse.json([]);
  }

  const today = todayJST();

  await ensureTodayQuests({ childId: user.id, familyId: user.familyId });

  // 今日のクエスト + carryOver の過去 PENDING を一括取得
  const quests = await prisma.questInstance.findMany({
    where: {
      childId: user.id,
      OR: [
        { date: today, template: { isActive: true } },
        { status: "PENDING", template: { isActive: true, carryOver: true } },
      ],
    },
    include: {
      template: {
        select: {
          id: true,
          title: true,
          emoji: true,
          category: true,
          isTemporary: true,
          createdBy: true,
          photoBonus: true,
          carryOver: true,
          createdAt: true,
          taskStreaks: {
            where: { childId: user.id },
            select: { currentStreak: true, bestStreak: true },
          },
        },
      },
    },
    orderBy: { template: { createdAt: "asc" } },
  });

  // 「今日やる宣言」用の集計: 各テンプレートの最終 APPROVED + 当日宣言の有無
  const templateIds = Array.from(new Set(quests.map((q) => q.templateId)));
  const [lastApprovedRows, declarationsToday] = await Promise.all([
    templateIds.length
      ? prisma.questInstance.groupBy({
          by: ["templateId"],
          where: { childId: user.id, templateId: { in: templateIds }, status: "APPROVED" },
          _max: { approvedAt: true },
        })
      : Promise.resolve([] as { templateId: string; _max: { approvedAt: Date | null } }[]),
    templateIds.length
      ? prisma.questDeclaration.findMany({
          where: { childId: user.id, date: today, templateId: { in: templateIds } },
          select: { templateId: true },
        })
      : Promise.resolve([] as { templateId: string }[]),
  ]);

  const lastApprovedByTemplate = new Map<string, Date | null>(
    lastApprovedRows.map((r) => [r.templateId, r._max.approvedAt]),
  );
  const declaredTemplateIds = new Set(declarationsToday.map((d) => d.templateId));

  const hasDeadline = !!user.reportDeadlineTime;
  return NextResponse.json(quests.map((q) => {
    const lastApprovedAt = lastApprovedByTemplate.get(q.templateId) ?? null;
    const idleDays = getIdleDays({
      today,
      lastApprovedAt,
      templateCreatedAt: q.template.createdAt,
    });
    return {
      ...q,
      hasDeadline,
      idleDays,
      declaredToday: declaredTemplateIds.has(q.templateId),
      template: {
        ...q.template,
        title: q.snapshotTitle ?? q.template.title,
        emoji: q.snapshotEmoji ?? q.template.emoji,
        category: q.snapshotCategory ?? q.template.category,
      },
    };
  }));
}
