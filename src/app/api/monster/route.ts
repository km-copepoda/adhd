import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { XP_MAP } from "@/lib/constants";

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
    const xp = XP_MAP[q.template.difficulty];
    if (q.template.category === "STUDY") pendingStudyPt += xp;
    else if (q.template.category === "STAMINA") pendingStaminaPt += xp;
    else if (q.template.category === "LIFE") pendingLifePt += xp;
  }

  return NextResponse.json({
    name: user.monsterName || user.name || "ぼうけんしゃ",
    evolutionStage: user.evolutionStage,
    evolutionPath: user.evolutionPath,
    studyPt: user.studyPt,
    staminaPt: user.staminaPt,
    lifePt: user.lifePt,
    pendingStudyPt,
    pendingStaminaPt,
    pendingLifePt,
  });
}
