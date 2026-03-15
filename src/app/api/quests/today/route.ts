import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !user.familyId) {
    return NextResponse.json([]);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon, ...

  // Get active templates for today (regular + temporary)
  const templates = await prisma.taskTemplate.findMany({
    where: {
      familyId: user.familyId,
      isActive: true,
      OR: [
        // 通常タスク: 今日の曜日に対応
        { isTemporary: false, repeatDays: { has: dayOfWeek } },
        // 一時タスク: targetDate が今日、または未指定（null = 当日扱い）
        { isTemporary: true, targetDate: today },
        { isTemporary: true, targetDate: null },
      ],
    },
  });

  // Create quest instances for today if they don't exist
  for (const template of templates) {
    await prisma.questInstance.upsert({
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
    });
  }

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
          difficulty: true,
          isTemporary: true,
          createdBy: true,
        },
      },
    },
    orderBy: { template: { createdAt: "asc" } },
  });

  return NextResponse.json(quests);
}
