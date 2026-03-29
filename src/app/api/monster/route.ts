import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  // 承認待ち（REPORTED）クエストのXPをカテゴリ別に集計
  const pendingQuests = await prisma.questInstance.findMany({
    where: { childId: user.id, status: "REPORTED" },
    include: { template: true },
  });

  let pendingStudyPt = 0, pendingStaminaPt = 0, pendingLifePt = 0;
  for (const q of pendingQuests) {
    let xp = 1;
    if (q.deadlineBonusEarned) xp++;
    if (q.template.photoBonus && q.photoUrl) xp++;
    if (q.template.category === "STUDY") pendingStudyPt += xp;
    else if (q.template.category === "STAMINA") pendingStaminaPt += xp;
    else if (q.template.category === "LIFE") pendingLifePt += xp;
  }

  return NextResponse.json({
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
  });
}
