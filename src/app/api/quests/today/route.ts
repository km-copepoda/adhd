import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { todayJST } from "@/lib/date";
import { ensureTodayQuests } from "@/lib/quests";

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
