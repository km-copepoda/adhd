import { prisma } from "@/lib/prisma";
import { checkEvolution } from "@/lib/constants";
import { recordDailyAchievement, recordTaskStreak } from "@/lib/streak";
import { checkAndUnlockBadges } from "@/lib/badges";
import { log } from "@/lib/logger";

type QuestWithRelations = {
  id: string;
  date: Date;
  childId: string;
  templateId: string;
  deadlineBonusEarned: boolean;
  photoUrl: string | null;
  template: {
    id: string;
    category: "STUDY" | "STAMINA" | "LIFE";
    photoBonus: boolean;
    createdBy: "PARENT" | "CHILD";
    isTemporary: boolean;
  };
  child: {
    id: string;
    evolutionStage: number;
    evolutionPath: string;
    collectedPaths: string;
    studyPt: number;
    staminaPt: number;
    lifePt: number;
  };
};

type FreshChildData = {
  id: string;
  evolutionStage: number;
  evolutionPath: string;
  collectedPaths: string;
  monsterLevels: string;
  studyPt: number;
  staminaPt: number;
  lifePt: number;
  rebirthPending: boolean;
  rebirthEggBonus: string | null;
};

/** ボーナスベースのXP計算: 基本1 + 期限ボーナス + 写真ボーナス (最大3) */
function calculateXP(quest: QuestWithRelations): number {
  let xp = 1;
  if (quest.deadlineBonusEarned) xp++;
  if (quest.template.photoBonus && quest.photoUrl) xp++;
  return xp;
}

export async function approveQuestInstance(quest: QuestWithRelations): Promise<void> {
  const xp = calculateXP(quest);
  const category = quest.template.category;

  // 最新のchildデータをDBから取得（stale dataによるポイント上書きを防ぐ）
  const child = await prisma.user.findUnique({
    where: { id: quest.childId },
    select: {
      id: true,
      evolutionStage: true,
      evolutionPath: true,
      collectedPaths: true,
      monsterLevels: true,
      studyPt: true,
      staminaPt: true,
      lifePt: true,
      rebirthPending: true,
      rebirthEggBonus: true,
    },
  }) as FreshChildData | null;
  if (!child) throw new Error(`Child ${quest.childId} not found`);

  const newStudy = child.studyPt + (category === "STUDY" ? xp : 0);
  const newStamina = child.staminaPt + (category === "STAMINA" ? xp : 0);
  const newLife = child.lifePt + (category === "LIFE" ? xp : 0);

  log.info("Quest approved", { questId: quest.id, childId: quest.childId, xp, category });

  await prisma.questInstance.update({
    where: { id: quest.id },
    data: { status: "APPROVED", approvedAt: new Date() },
  });

  if (child.rebirthPending) {
    // 転生待ち中: XPだけ加算し、進化・転生チェックはスキップ
    await prisma.user.update({
      where: { id: quest.childId },
      data: {
        studyPt: newStudy,
        staminaPt: newStamina,
        lifePt: newLife,
      },
    });
  } else {
    const isReborn = (JSON.parse(child.collectedPaths) as string[]).length > 0;
    const evolution = checkEvolution(
      child.evolutionStage,
      child.evolutionPath,
      newStudy,
      newStamina,
      newLife,
      isReborn,
      child.rebirthEggBonus,
    );

    let collectedPaths = JSON.parse(child.collectedPaths) as string[];
    const monsterLevels = JSON.parse(child.monsterLevels ?? "{}") as Record<string, number>;

    if (evolution.reborn) {
      // 転生閾値到達: pendingフラグをセット（実際のリセットはユーザー操作後）
      await prisma.user.update({
        where: { id: quest.childId },
        data: {
          studyPt: newStudy,
          staminaPt: newStamina,
          lifePt: newLife,
          rebirthPending: true,
        },
      });
    } else {
      // 通常の進化またはポイント加算
      if (evolution.evolved) {
        if (!collectedPaths.includes(evolution.newPath)) {
          collectedPaths = [...collectedPaths, evolution.newPath];
        }
        if (evolution.newStage === 3) {
          monsterLevels[evolution.newPath] = (monsterLevels[evolution.newPath] ?? 0) + 1;
        }
        log.info("Monster evolved", {
          childId: quest.childId,
          stage: evolution.newStage,
          path: evolution.newPath,
        });
      }
      await prisma.user.update({
        where: { id: quest.childId },
        data: {
          studyPt: evolution.resetStudy,
          staminaPt: evolution.resetStamina,
          lifePt: evolution.resetLife,
          evolutionStage: evolution.newStage,
          evolutionPath: evolution.newPath,
          collectedPaths: JSON.stringify(collectedPaths),
          monsterLevels: JSON.stringify(monsterLevels),
        },
      });
    }
  }

  if (quest.template.createdBy === "CHILD") {
    await prisma.taskTemplate.update({
      where: { id: quest.templateId },
      data: { createdBy: "PARENT" },
    });
  }

  await recordDailyAchievement(quest.childId, quest.date);
  if (!quest.template.isTemporary) {
    await recordTaskStreak(quest.templateId, quest.childId, quest.date);
  }

  // バッジ解除チェック（エラーが出ても承認フロー全体には影響させない）
  checkAndUnlockBadges(quest.childId).catch(err =>
    log.error("Badge check failed", { childId: quest.childId, err }),
  );
}

export async function approveSkipQuestInstance(quest: Pick<QuestWithRelations, "id" | "childId" | "date">): Promise<void> {
  await prisma.questInstance.update({
    where: { id: quest.id },
    data: { status: "SKIPPED", approvedAt: new Date() },
  });
  await recordDailyAchievement(quest.childId, quest.date);
}
