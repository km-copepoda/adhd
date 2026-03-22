import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { todayJST } from "@/lib/date";

type HistoryStatus = "APPROVED" | "SKIPPED" | "NO_ACTION";

function parseDate(dateStr: string | null): Date {
  if (!dateStr) {
    return todayJST();
  }
  const parsed = new Date(`${dateStr}T00:00:00Z`);
  if (isNaN(parsed.getTime())) {
    return todayJST();
  }
  return parsed;
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "PARENT" || !user.familyId) {
    return NextResponse.json([]);
  }

  const { searchParams } = new URL(request.url);
  const targetDate = parseDate(searchParams.get("date"));
  const dayOfWeek = targetDate.getDay(); // 0=Sun, 1=Mon, ...

  // Step 1: Get all QuestInstances on that date for this family
  const instances = await prisma.questInstance.findMany({
    where: {
      date: targetDate,
      template: { familyId: user.familyId },
    },
    include: {
      child: { select: { id: true, name: true, monsterName: true, side: true } },
      template: { select: { title: true, emoji: true, category: true, difficulty: true, isActive: true } },
    },
    orderBy: { approvedAt: "desc" },
  });

  // Collect (templateId, childId) pairs already covered by instances
  const coveredPairs = new Set(instances.map((i) => `${i.templateId}:${i.childId}`));

  const nextDay = new Date(targetDate);
  nextDay.setDate(nextDay.getDate() + 1);

  // Step 2: Get active templates scheduled for that day without a QuestInstance
  // Only include templates that existed on targetDate (createdAt < nextDay)
  const templates = await prisma.taskTemplate.findMany({
    where: {
      familyId: user.familyId,
      isActive: true,
      createdAt: { lt: nextDay },
      OR: [
        { isTemporary: false, createdBy: "PARENT", repeatDays: { has: dayOfWeek } },
        { isTemporary: true, targetDate },
      ],
    },
    include: {
      assignedChild: { select: { id: true, name: true, monsterName: true, side: true } },
    },
  });

  // Filter out templates already covered by a QuestInstance
  const uncoveredTemplates = templates.filter(
    (t) => t.assignedChildId && !coveredPairs.has(`${t.id}:${t.assignedChildId}`)
  );

  // Build response
  // 削除済みテンプレート（isActive=false）はAPPROVEDのみ表示、それ以外は除外
  const result = [
    ...instances
      .filter((i) => i.template.isActive || i.status === "APPROVED")
      .map((i) => ({
        id: i.id,
        status: (i.status === "APPROVED" || i.status === "SKIPPED"
          ? i.status
          : "NO_ACTION") as HistoryStatus,
        date: i.date,
        approvedAt: i.approvedAt,
        comment: i.comment,
        child: i.child,
        template: i.template,
      })),
    ...uncoveredTemplates.map((t) => ({
      id: null,
      status: "NO_ACTION" as HistoryStatus,
      date: targetDate,
      approvedAt: null,
      comment: null,
      child: t.assignedChild,
      template: {
        title: t.title,
        emoji: t.emoji,
        category: t.category,
        difficulty: t.difficulty,
      },
    })),
  ];

  return NextResponse.json(result);
}
