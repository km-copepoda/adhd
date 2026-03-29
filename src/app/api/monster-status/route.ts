import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStreakTitle } from "@/lib/constants";
import { monthStartJST, monthEndJST } from "@/lib/date";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const monthStart = monthStartJST();
  const monthEnd = monthEndJST();

  // 3クエリを並列実行
  const [pendingQuests, streakRecord, monthlyQuests] = await Promise.all([
    prisma.questInstance.findMany({
      where: { childId: user.id, status: "REPORTED" },
      include: { template: true },
    }),
    prisma.streak.findUnique({ where: { childId: user.id } }),
    prisma.questInstance.findMany({
      where: {
        childId: user.id,
        OR: [{ status: "APPROVED" }, { status: "SKIPPED" }],
        date: { gte: monthStart, lte: monthEnd },
      },
      select: { date: true },
      distinct: ["date"],
    }),
  ]);

  let pendingStudyPt = 0, pendingStaminaPt = 0, pendingLifePt = 0;
  for (const q of pendingQuests) {
    let xp = 1;
    if (q.deadlineBonusEarned) xp++;
    if (q.template.photoBonus && q.photoUrl) xp++;
    if (q.template.category === "STUDY") pendingStudyPt += xp;
    else if (q.template.category === "STAMINA") pendingStaminaPt += xp;
    else if (q.template.category === "LIFE") pendingLifePt += xp;
  }

  const title = getStreakTitle(streakRecord?.currentStreak ?? 0);

  return NextResponse.json({
    // monster fields
    name: user.monsterName || user.name || "ぼうけんしゃ",
    side: user.side,
    evolutionStage: user.evolutionStage,
    evolutionPath: user.evolutionPath,
    collectedPaths: user.collectedPaths,
    studyPt: user.studyPt,
    staminaPt: user.staminaPt,
    lifePt: user.lifePt,
    pendingStudyPt,
    pendingStaminaPt,
    pendingLifePt,
    // streak fields
    currentStreak: streakRecord?.currentStreak ?? 0,
    bestStreak: streakRecord?.bestStreak ?? 0,
    monthlyDays: monthlyQuests.length,
    lastAchievedDate: streakRecord?.lastAchievedDate?.toISOString().split("T")[0] ?? null,
    currentTitle: title ? { title: title.title, emoji: title.emoji } : null,
  });
}
