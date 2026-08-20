import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkEvolution } from "@/lib/evolution";
import { recordDailyAchievement, recordTaskStreak } from "@/lib/streak";
import { checkAndUnlockBadges } from "@/lib/badges";
import { log } from "@/lib/logger";
import { calculateQuestXP } from "@/lib/xp";
import { getMonsterStage } from "@/lib/monsters";
import { addCollectedPath } from "@/lib/monsterThemes/collectedPaths";
import { incrementMonsterLevel } from "@/lib/monsterThemes/monsterLevels";
import { triggerMonsterEvolvedLog, triggerBadgeLog } from "@/lib/bulletinLog";
import { DECLARATION_BONUS_XP } from "@/lib/declaration";
import { todayJST, jstDateOf } from "@/lib/date";
import { unlockTreasuresOnApprove } from "@/lib/treasureService";

export type QuestWithRelations = {
  id: string;
  date: Date;
  reportedAt?: Date | null;
  childId: string;
  templateId: string;
  deadlineBonusEarned: boolean;
  photoUrl: string | null;
  snapshotCategory: "STUDY" | "STAMINA" | "LIFE";
  template: {
    id: string;
    category: "STUDY" | "STAMINA" | "LIFE";
    photoBonus: boolean;
    createdBy: "PARENT" | "CHILD";
    isTemporary: boolean;
    repeatDays: number[];
    // carryOver 過去日付タスクの unlock 日付を「今日基準」に切り替えるために必要。
    // 2026-06-19 で生成側は今日基準に切替済みだが、unlock を quest.date にすると
    // LOCKED 宝箱が永久に残る (生成が今日 / unlock が過去日付 で不一致)。
    carryOver: boolean;
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

export type FreshChildData = {
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
  side: string | null;
  monsterSetId: string;
};

export async function approveQuestInstance(quest: QuestWithRelations, stamp?: string): Promise<void> {
  const baseXp = calculateQuestXP(quest);

  // 「今日やる宣言ボーナス」: 報告日（JST）に対応する宣言があれば +1
  const reportedDate = quest.reportedAt ? jstDateOf(quest.reportedAt) : todayJST();
  const declaration = await prisma.questDeclaration.findUnique({
    where: {
      templateId_childId_date: {
        templateId: quest.templateId,
        childId: quest.childId,
        date: reportedDate,
      },
    },
  });
  const declarationBonus = declaration ? DECLARATION_BONUS_XP : 0;

  const xp = baseXp + declarationBonus;
  const category = quest.snapshotCategory ?? quest.template.category;

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
      side: true,
      monsterSetId: true,
    },
  }) as FreshChildData | null;
  if (!child) throw new Error(`Child ${quest.childId} not found`);

  const newStudy = child.studyPt + (category === "STUDY" ? xp : 0);
  const newStamina = child.staminaPt + (category === "STAMINA" ? xp : 0);
  const newLife = child.lifePt + (category === "LIFE" ? xp : 0);

  log.info("Quest approved", { questId: quest.id, childId: quest.childId, xp, category });

  await prisma.questInstance.update({
    where: { id: quest.id },
    data: {
      status: "APPROVED",
      approvedAt: new Date(),
      ...(stamp ? { approvalStamp: stamp } : {}),
    },
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
    let monsterLevels = JSON.parse(child.monsterLevels ?? "{}") as Record<string, number>;

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
        collectedPaths = addCollectedPath(collectedPaths, child.monsterSetId, evolution.newPath);
        if (evolution.newStage === 3) {
          monsterLevels = incrementMonsterLevel(monsterLevels, child.monsterSetId, evolution.newPath);
        }
        log.info("Monster evolved", {
          childId: quest.childId,
          stage: evolution.newStage,
          path: evolution.newPath,
        });
        const evolvedMonster = getMonsterStage(evolution.newStage, evolution.newPath, child.monsterSetId);
        const evolvedName = evolvedMonster?.name ?? evolution.newPath;
        after(() => triggerMonsterEvolvedLog(quest.childId, evolvedName).catch(() => {}));
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
    await recordTaskStreak(quest.templateId, quest.childId, quest.date, quest.template.repeatDays);
  }

  // 同日の LOCKED 宝箱を UNLOCKED に。0個でも安全 (updateMany)
  // carryOver 過去日付は生成側 (2026-06-19) に合わせて今日基準で検索する。
  await unlockTreasuresOnApprove(quest.childId, effectiveTreasureDate(quest.date, quest.template.carryOver));

  // バッジ解除チェック + 掲示板ログ — レスポンス送信後に after() で実行
  after(() =>
    checkAndUnlockBadges(quest.childId)
      .then((newBadges) => {
        for (const badge of newBadges) {
          triggerBadgeLog(quest.childId, badge.name).catch(() => {});
        }
      })
      .catch(err => log.error("Badge check failed", { childId: quest.childId, err })),
  );
}

export async function approveSkipQuestInstance(
  quest: Pick<QuestWithRelations, "id" | "childId" | "date"> & {
    template: Pick<QuestWithRelations["template"], "carryOver">;
  },
): Promise<void> {
  await prisma.questInstance.update({
    where: { id: quest.id },
    data: { status: "SKIPPED", approvedAt: new Date() },
  });
  await recordDailyAchievement(quest.childId, quest.date);
  await unlockTreasuresOnApprove(
    quest.childId,
    effectiveTreasureDate(quest.date, quest.template.carryOver),
  );
}

/**
 * 承認時の宝箱 unlock 対象日付を返す。
 * carryOver=true かつ quest.date が今日より過去なら「今日」を返す
 * (生成側 2026-06-19 の集計切替と揃える)。それ以外は quest.date そのまま。
 */
function effectiveTreasureDate(questDate: Date, carryOver: boolean): Date {
  const today = todayJST();
  if (carryOver && questDate.getTime() < today.getTime()) return today;
  return questDate;
}
