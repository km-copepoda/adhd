import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStreakTitle } from "@/lib/streakMilestones";
import { monthStartJST, monthEndJST } from "@/lib/date";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const streak = await prisma.streak.findUnique({
    where: { childId: user.id },
  });

  // 今月の達成日数（APPROVED or SKIPPED クエストの DISTINCT date）
  const monthStart = monthStartJST();
  const monthEnd = monthEndJST();

  const monthlyQuests = await prisma.questInstance.findMany({
    where: {
      childId: user.id,
      OR: [{ status: "APPROVED" }, { status: "SKIPPED" }],
      date: { gte: monthStart, lte: monthEnd },
    },
    select: { date: true },
    distinct: ["date"],
  });

  const monthlyDays = monthlyQuests.length;

  const title = getStreakTitle(streak?.currentStreak ?? 0);

  return NextResponse.json({
    currentStreak: streak?.currentStreak ?? 0,
    bestStreak: streak?.bestStreak ?? 0,
    monthlyDays,
    lastAchievedDate: streak?.lastAchievedDate?.toISOString().split("T")[0] ?? null,
    currentTitle: title ? { title: title.title, emoji: title.emoji } : null,
  });
}
