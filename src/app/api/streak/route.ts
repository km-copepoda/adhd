import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStreakTitle } from "@/lib/constants";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const streak = await prisma.streak.findUnique({
    where: { childId: user.id },
  });

  // 今月の達成日数（APPROVED or SKIPPED クエストの DISTINCT date）
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

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

  // 休息券: 今週（月曜起算）にまだ使っていないか
  const restPassAvailable = !streak?.restPassUsedAt || !isInCurrentWeek(streak.restPassUsedAt);

  const title = getStreakTitle(streak?.currentStreak ?? 0);

  return NextResponse.json({
    currentStreak: streak?.currentStreak ?? 0,
    bestStreak: streak?.bestStreak ?? 0,
    monthlyDays,
    lastAchievedDate: streak?.lastAchievedDate?.toISOString().split("T")[0] ?? null,
    restPassAvailable,
    currentTitle: title ? { title: title.title, emoji: title.emoji } : null,
  });
}

function isInCurrentWeek(date: Date): boolean {
  const now = new Date();
  const getMonday = (d: Date) => {
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.getFullYear(), d.getMonth(), diff);
  };
  const currentMonday = getMonday(now);
  const dateMonday = getMonday(new Date(date));
  return currentMonday.getTime() === dateMonday.getTime();
}
