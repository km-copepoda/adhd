import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getStreakTitle } from "@/lib/streakMilestones";
import { monthStartJST, monthEndJST } from "@/lib/date";
import { pendingXpByCategory } from "@/lib/xp";
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
  const child = resolved.child as any;

  const monthStart = monthStartJST();
  const monthEnd = monthEndJST();

  const [pendingQuests, streakRecord, monthlyQuests] = await Promise.all([
    prisma.questInstance.findMany({
      where: { childId: child.id, status: "REPORTED" },
      include: { template: true },
    }),
    prisma.streak.findUnique({ where: { childId: child.id } }),
    prisma.questInstance.findMany({
      where: {
        childId: child.id,
        OR: [{ status: "APPROVED" }, { status: "SKIPPED" }],
        date: { gte: monthStart, lte: monthEnd },
      },
      select: { date: true },
      distinct: ["date"],
    }),
  ]);

  const templateIds = Array.from(new Set((pendingQuests as any[]).map((q) => q.templateId)));
  const declarations = templateIds.length
    ? await prisma.questDeclaration.findMany({
        where: { childId: child.id, templateId: { in: templateIds } },
        select: { templateId: true, date: true },
      })
    : [];
  const {
    STUDY: pendingStudyPt,
    STAMINA: pendingStaminaPt,
    LIFE: pendingLifePt,
  } = pendingXpByCategory(pendingQuests as any[], declarations);

  const title = getStreakTitle(streakRecord?.currentStreak ?? 0);

  return NextResponse.json({
    name: child.monsterName || child.name || "ぼうけんしゃ",
    side: child.side,
    evolutionStage: child.evolutionStage,
    evolutionPath: child.evolutionPath,
    collectedPaths: child.collectedPaths,
    studyPt: child.studyPt,
    staminaPt: child.staminaPt,
    lifePt: child.lifePt,
    pendingStudyPt,
    pendingStaminaPt,
    pendingLifePt,
    rebirthPending: child.rebirthPending,
    rebirthEggBonus: child.rebirthEggBonus,
    currentStreak: streakRecord?.currentStreak ?? 0,
    bestStreak: streakRecord?.bestStreak ?? 0,
    monthlyDays: monthlyQuests.length,
    lastAchievedDate: streakRecord?.lastAchievedDate?.toISOString().split("T")[0] ?? null,
    currentTitle: title ? { title: title.title, emoji: title.emoji } : null,
  });
}
