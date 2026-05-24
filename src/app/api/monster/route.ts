import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pendingXpByCategory } from "@/lib/xp";

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

  return NextResponse.json({
    name: user.monsterName || user.name || "ぼうけんしゃ",
    side: user.side,
    evolutionStage: user.evolutionStage,
    evolutionPath: user.evolutionPath,
    collectedPaths: user.collectedPaths,
    monsterLevels: user.monsterLevels,
    studyPt: user.studyPt,
    staminaPt: user.staminaPt,
    lifePt: user.lifePt,
    pendingStudyPt,
    pendingStaminaPt,
    pendingLifePt,
    usedEggBonuses: user.usedEggBonuses ?? "[]",
  });
}
