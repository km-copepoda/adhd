import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma, QuestStatus } from "@/generated/prisma/client";
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
import { resolveTreasureDate } from "@/lib/treasureDate";
import { lockUserForUpdate } from "@/lib/rowLock";

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

/**
 * #183: status 条件付きの QuestInstance 更新（アトミックな遷移）。
 * 遷移元 status に一致しなければ P2025 となり false を返す（レース負け）。
 * それ以外のエラーは再スローする。
 */
export async function transitionQuestStatus(
  id: string,
  fromStatuses: QuestStatus[],
  data: Prisma.QuestInstanceUpdateInput,
  client: Prisma.TransactionClient = prisma,
): Promise<boolean> {
  try {
    await client.questInstance.update({
      where: { id, status: { in: fromStatuses } },
      data,
    });
    return true;
  } catch (err) {
    if ((err as { code?: string } | null)?.code === "P2025") return false;
    throw err;
  }
}

/**
 * クエスト承認。宣言ボーナスの読み取りを済ませた後、status 遷移（→APPROVED）と XP 付与等を
 * 単一トランザクションで行い、レースに負けた場合は XP 付与等を一切せず false を返す。
 */
export async function approveQuestInstance(
  quest: QuestWithRelations,
  stamp?: string,
  options?: {
    fromStatuses?: QuestStatus[];
    /** 親代理報告など、claim と同一の更新に含めたい追加フィールド（勝者だけが書く） */
    extraData?: Prisma.QuestInstanceUpdateInput;
  },
): Promise<boolean> {
  const fromStatuses = options?.fromStatuses ?? ["REPORTED"];

  // 宣言ボーナスの読み取りはトランザクション前に行う（tx を短く保つ）。
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

  // 遷移・User 行ロック・XP 更新を 1 トランザクションで行う。
  // 行ロックする理由: 同じ子の別クエストを同時承認すると、両方が同じ XP を読んで
  // 絶対値で書き戻し、片方の加算が消える（ロスト更新）。ロック後に最新値を読み直して直列化する。
  // また遷移後に XP 更新が失敗しても全体がロールバックされ、APPROVED のまま XP 欠落しない。
  let evolvedName: string | null = null;
  const won = await prisma.$transaction(async (tx) => {
    const claimed = await transitionQuestStatus(
      quest.id,
      fromStatuses,
      {
        ...(options?.extraData ?? {}),
        status: "APPROVED",
        approvedAt: new Date(),
        ...(stamp ? { approvalStamp: stamp } : {}),
      },
      tx,
    );
    if (!claimed) return false;

    await lockUserForUpdate(tx, quest.childId);

    // ロック取得後の最新 child（stale data によるポイント上書きを防ぐ）
    const child = await tx.user.findUnique({
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

    if (child.rebirthPending) {
      // 転生待ち中: XPだけ加算し、進化・転生チェックはスキップ
      await tx.user.update({
        where: { id: quest.childId },
        data: { studyPt: newStudy, staminaPt: newStamina, lifePt: newLife },
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
        await tx.user.update({
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
          evolvedName = evolvedMonster?.name ?? evolution.newPath;
        }
        await tx.user.update({
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
      await tx.taskTemplate.update({
        where: { id: quest.templateId },
        data: { createdBy: "PARENT" },
      });
    }
    return true;
  });
  if (!won) {
    log.warn("Quest approval skipped: status changed concurrently", { questId: quest.id });
    return false;
  }

  // 進化ログはコミット後（ロールバックされた場合に残さない）
  if (evolvedName) {
    const name: string = evolvedName;
    after(() => triggerMonsterEvolvedLog(quest.childId, name).catch(() => {}));
  }

  await recordDailyAchievement(quest.childId, quest.date);
  if (!quest.template.isTemporary) {
    await recordTaskStreak(quest.templateId, quest.childId, quest.date, quest.template.repeatDays);
  }

  // 同日の LOCKED 宝箱を UNLOCKED に。0個でも安全 (updateMany)
  // carryOver 過去日付は生成側 (report/skip) が使った基準日 (reportedAt) と揃える。
  // reportedAt が無い場合（親代理の即承認など）は承認時刻にフォールバックする。
  await unlockTreasuresOnApprove(
    quest.childId,
    resolveTreasureDate(quest.date, quest.template.carryOver, quest.reportedAt ?? new Date()),
  );

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
  return true;
}

export async function approveSkipQuestInstance(
  quest: Pick<QuestWithRelations, "id" | "childId" | "date" | "reportedAt"> & {
    template: Pick<QuestWithRelations["template"], "carryOver">;
  },
  options?: { fromStatuses?: QuestStatus[]; extraData?: Prisma.QuestInstanceUpdateInput },
): Promise<boolean> {
  const won = await transitionQuestStatus(quest.id, options?.fromStatuses ?? ["SKIP_REPORTED"], {
    ...(options?.extraData ?? {}),
    status: "SKIPPED",
    approvedAt: new Date(),
  });
  if (!won) {
    log.warn("Skip approval skipped: status changed concurrently", { questId: quest.id });
    return false;
  }
  await recordDailyAchievement(quest.childId, quest.date);
  await unlockTreasuresOnApprove(
    quest.childId,
    resolveTreasureDate(quest.date, quest.template.carryOver, quest.reportedAt ?? new Date()),
  );
  return true;
}

// ─── #151: ごほうび使用申請の親承認フロー ─────────────────────────
//
// XP・進化(checkEvolution)・ストリーク・バッジには一切触れない
// （ごほうび使用は既に付与済みの実物の受け渡し確認であり、成長要素と無関係）。
// すべて条件付き updateMany（where に現在の useStatus を含める）で、
// TOCTOU レース・多重実行に対して安全にする。呼び出し元が count===0（レース負け）
// を判別できるよう、Prisma の BatchPayload をそのまま返す。

/** USE_REQUESTED -> USED。fulfilled も同時に true へ同期する。 */
export async function approveTreasureUse(logId: string): Promise<{ count: number }> {
  return prisma.treasureLog.updateMany({
    where: { id: logId, useStatus: "USE_REQUESTED" },
    data: { useStatus: "USED", useApprovedAt: new Date(), fulfilled: true },
  });
}

/**
 * #164: UNUSED / USE_REQUESTED -> USED（親が承認なしで直接使用）。
 * useRequestedAt は触らない（UNUSED 起点では null のまま。虚偽の申請記録を作らない）。
 */
export async function useTreasureByParent(logId: string): Promise<{ count: number }> {
  return prisma.treasureLog.updateMany({
    where: { id: logId, useStatus: { in: ["UNUSED", "USE_REQUESTED"] } },
    data: { useStatus: "USED", fulfilled: true, useApprovedAt: new Date() },
  });
}

/** USE_REQUESTED -> UNUSED（却下）。useRequestedAt をクリアし再申請可能にする。 */
export async function rejectTreasureUse(logId: string): Promise<{ count: number }> {
  return prisma.treasureLog.updateMany({
    where: { id: logId, useStatus: "USE_REQUESTED" },
    data: { useStatus: "UNUSED", useRequestedAt: null },
  });
}

/** USED -> UNUSED（巻き戻し）。useRequestedAt / useApprovedAt を両方クリアし再申請可能にする。 */
export async function revokeTreasureUse(logId: string): Promise<{ count: number }> {
  return prisma.treasureLog.updateMany({
    where: { id: logId, useStatus: "USED" },
    data: { useStatus: "UNUSED", useRequestedAt: null, useApprovedAt: null, fulfilled: false },
  });
}

/**
 * #151: cron 用 — cutoff（JST今日0:00）より前に申請されたまま放置された
 * 「ごほうび使用申請」(USE_REQUESTED) をまとめて自動承認する。
 * 書き込み内容は `approveTreasureUse` と同一だが、対象を1件のIDではなく
 * cutoff より前の USE_REQUESTED 全件に広げたもの。
 * itemId===null（コレクション獲得）は使用申請の概念が無く常に UNUSED 固定なので対象外。
 */
export async function autoApproveStaleTreasureUses(cutoff: Date): Promise<{ count: number }> {
  return prisma.treasureLog.updateMany({
    where: {
      useStatus: "USE_REQUESTED",
      itemId: { not: null },
      useRequestedAt: { lt: cutoff },
    },
    data: { useStatus: "USED", useApprovedAt: new Date(), fulfilled: true },
  });
}
