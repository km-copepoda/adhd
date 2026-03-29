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

  // Create quest instances for today if they don't exist (parallel)
  await Promise.all(
    templates.map((template) =>
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
        },
      })
    )
  );

  // Fetch all today's quests (active templates only)
  const quests = await prisma.questInstance.findMany({
    where: {
      childId: user.id,
      date: today,
      template: { isActive: true },
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
          taskStreaks: {
            where: { childId: user.id },
            select: { currentStreak: true, bestStreak: true },
          },
        },
      },
    },
    orderBy: { template: { createdAt: "asc" } },
  });

  return NextResponse.json(quests);
}
