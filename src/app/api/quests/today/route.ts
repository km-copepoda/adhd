import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { todayJST, dayOfWeekJST } from "@/lib/date";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !user.familyId) {
    return NextResponse.json([]);
  }

  const today = todayJST();
  const dayOfWeek = dayOfWeekJST();

  // Get active templates for today (regular + temporary) assigned to this child
  const templates = await prisma.taskTemplate.findMany({
    where: {
      familyId: user.familyId,
      assignedChildId: user.id,
      isActive: true,
      OR: [
        // 承認済み通常タスク: 今日の曜日に対応
        { isTemporary: false, createdBy: "PARENT", repeatDays: { has: dayOfWeek } },
        // 未承認の子供タスク: 申請日（requestedDate）が今日かつ今日の曜日に対応
        // → 日付をまたいでも申請日以外に表示されない
        { isTemporary: false, createdBy: "CHILD", requestedDate: today, repeatDays: { has: dayOfWeek } },
        // 一時タスク: targetDate が今日
        { isTemporary: true, targetDate: today },
      ],
    },
  });

  // carryOver タスクは既存 PENDING がある場合 upsert をスキップ（1インスタンス保証）
  const carryOverTemplates = templates.filter((t) => (t as any).carryOver);
  const normalTemplates = templates.filter((t) => !(t as any).carryOver);

  const carryOverChecks = await Promise.all(
    carryOverTemplates.map(async (template) => {
      const existing = await prisma.questInstance.findFirst({
        where: { templateId: template.id, childId: user.id, status: "PENDING" },
      });
      return { template, hasPending: !!existing };
    })
  );

  // 通常テンプレート + PENDING がない carryOver テンプレートのみ upsert
  const templatesToUpsert = [
    ...normalTemplates,
    ...carryOverChecks.filter((c) => !c.hasPending).map((c) => c.template),
  ];

  await Promise.all(
    templatesToUpsert.map((template) =>
      prisma.questInstance.upsert({
        where: {
          templateId_childId_date: {
            templateId: template.id,
            childId: user.id,
            date: today,
          },
        },
        update: {},
        create: {
          templateId: template.id,
          childId: user.id,
          date: today,
          snapshotTitle: template.title,
          snapshotEmoji: template.emoji,
          snapshotCategory: template.category,
        },
      })
    )
  );

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
          taskStreaks: {
            where: { childId: user.id },
            select: { currentStreak: true, bestStreak: true },
          },
        },
      },
    },
    orderBy: { template: { createdAt: "asc" } },
  });

  const hasDeadline = !!user.reportDeadlineTime;
  return NextResponse.json(quests.map((q) => ({
    ...q,
    hasDeadline,
    template: {
      ...q.template,
      title: q.snapshotTitle ?? q.template.title,
      emoji: q.snapshotEmoji ?? q.template.emoji,
      category: q.snapshotCategory ?? q.template.category,
    },
  })));
}
