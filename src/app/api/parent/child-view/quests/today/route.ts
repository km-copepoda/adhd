import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { todayJST } from "@/lib/date";
import { ensureTodayQuests } from "@/lib/quests";
import { resolveTargetChild } from "@/lib/parentChildView";

export async function GET(request: Request) {
  const parent = await getCurrentUser();
  if (!parent) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const url = new URL(request.url);
  const childId = url.searchParams.get("childId");

  const resolved = await resolveTargetChild(parent, childId);
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }
  const child = resolved.child;

  const today = todayJST();

  if (child.familyId) {
    await ensureTodayQuests({ childId: child.id, familyId: child.familyId });
  }

  const quests = await prisma.questInstance.findMany({
    where: {
      childId: child.id,
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
            where: { childId: child.id },
            select: { currentStreak: true, bestStreak: true },
          },
        },
      },
    },
    orderBy: { template: { createdAt: "asc" } },
  });

  const hasDeadline = !!child.reportDeadlineTime;
  return NextResponse.json(
    quests.map((q: any) => ({
      ...q,
      hasDeadline,
      template: {
        ...q.template,
        title: q.snapshotTitle ?? q.template.title,
        emoji: q.snapshotEmoji ?? q.template.emoji,
        category: q.snapshotCategory ?? q.template.category,
      },
    })),
  );
}
