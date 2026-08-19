// 親代理（子供モード）— 子供の図鑑描画に必要なデータを返す。
//
// GET /api/parent/child-view/monster?childId=X
// 既存 /api/monster は CHILD セッション専用。図鑑タブ用に並走経路として新設する。

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pendingXpByCategory } from "@/lib/xp";
import { resolveTargetChild } from "@/lib/parentChildView";
import { resolveOwnedThemes } from "@/lib/monsterThemes/ownedThemes";

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

  const [pendingQuests, ownedThemeRecords] = await Promise.all([
    prisma.questInstance.findMany({
      where: { childId: child.id, status: "REPORTED" },
      include: { template: true },
    }),
    prisma.childMonsterTheme.findMany({ where: { childId: child.id } }),
  ]);
  const ownedThemes = resolveOwnedThemes(ownedThemeRecords, child.monsterSetId);

  const templateIds = Array.from(new Set(pendingQuests.map((q) => q.templateId)));
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
  } = pendingXpByCategory(pendingQuests, declarations);

  return NextResponse.json({
    name: child.monsterName || child.name || "ぼうけんしゃ",
    side: child.side,
    evolutionStage: child.evolutionStage,
    evolutionPath: child.evolutionPath,
    collectedPaths: child.collectedPaths,
    monsterLevels: child.monsterLevels,
    studyPt: child.studyPt,
    staminaPt: child.staminaPt,
    lifePt: child.lifePt,
    pendingStudyPt,
    pendingStaminaPt,
    pendingLifePt,
    usedEggBonuses: child.usedEggBonuses ?? "[]",
    monsterSetId: child.monsterSetId,
    ownedThemes,
  });
}
