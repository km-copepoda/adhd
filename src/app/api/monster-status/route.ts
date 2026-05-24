import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStreakTitle } from "@/lib/streakMilestones";
import { monthStartJST, monthEndJST } from "@/lib/date";
import { pendingXpByCategory } from "@/lib/xp";

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

  // 「今日やる宣言」ボーナスを仮 XP に含めるため、対応する宣言を一括取得
  const templateIds = Array.from(new Set(pendingQuests.map((q: { templateId: string }) => q.templateId)));
  const declarations = templateIds.length
    ? await prisma.questDeclaration.findMany({
        where: { childId: user.id, templateId: { in: templateIds } },
        select: { templateId: true, date: true },
      })
    : [];
  const {
    STUDY: pendingStudyPt,
    STAMINA: pendingStaminaPt,
    LIFE: pendingLifePt,
  } = pendingXpByCategory(pendingQuests, declarations);

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
    rebirthPending: user.rebirthPending,
    rebirthEggBonus: user.rebirthEggBonus,
    // streak fields
    currentStreak: streakRecord?.currentStreak ?? 0,
    bestStreak: streakRecord?.bestStreak ?? 0,
    monthlyDays: monthlyQuests.length,
    lastAchievedDate: streakRecord?.lastAchievedDate?.toISOString().split("T")[0] ?? null,
    currentTitle: title ? { title: title.title, emoji: title.emoji } : null,
  });
}
