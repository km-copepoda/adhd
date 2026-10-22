import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkEvolution } from "@/lib/evolution";
import { getMonsterStage } from "@/lib/monsters";
import { addCollectedPath } from "@/lib/monsterThemes/collectedPaths";
import { incrementMonsterLevel } from "@/lib/monsterThemes/monsterLevels";
import { getNewMilestoneBonus, distributeBonus, STREAK_MILESTONES } from "@/lib/streakMilestones";
import { log } from "@/lib/logger";
import { triggerStreakTitleLog, triggerMonsterEvolvedLog } from "@/lib/bulletinLog";
import { previousScheduledDate } from "@/lib/date";

/**
 * クエスト承認時にストリークを記録・更新する。
 * 当日の APPROVED 数が最低タスク数に達したらストリーク達成。
 * 当日の総クエスト数が最低数未満なら、全完了で達成扱い。
 */
export async function recordDailyAchievement(childId: string, questDate: Date) {
  // 子ユーザーの最低タスク数設定を取得
  const child = await prisma.user.findUnique({ where: { id: childId } });
  if (!child) return;
  const minTasks = child.minTasksForStreak;

  // 同日のクエスト数を集計（APPROVED + SKIPPED を達成数としてカウント）
  const [achievedCount, totalCount] = await Promise.all([
    prisma.questInstance.count({
      where: { childId, date: questDate, OR: [{ status: "APPROVED" }, { status: "SKIPPED" }] },
    }),
    prisma.questInstance.count({
      where: { childId, date: questDate },
    }),
  ]);

  // 必要数 = min(設定値, 当日総数) — タスクが少ない日は全完了でOK
  const required = Math.min(minTasks, totalCount);

  // ちょうど必要数に達した瞬間のみ処理（超過=既に記録済み）
  if (achievedCount !== required) return;

  // 読み取り→判定→条件付き更新を楽観ロックで行う（並行承認で巻き戻さない）
  const today = normalizeDate(questDate);
  const yesterday = new Date(today);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);

  let oldStreak = 0;
  let newStreak = 0;
  let newBest = 0;
  let updated = false;
  for (let attempt = 0; attempt < MAX_OPTIMISTIC_RETRIES && !updated; attempt++) {
    // 既存 Streak レコード取得（なければデフォルト値で作成）
    const streak = await prisma.streak.upsert({
      where: { childId },
      create: { childId, currentStreak: 0, bestStreak: 0 },
      update: {},
    });
    const lastDate = streak.lastAchievedDate ? normalizeDate(streak.lastAchievedDate) : null;

    // 同日処理済み
    if (lastDate && lastDate.getTime() === today.getTime()) return;
    // 既により新しい日付が記録済み（古い日付の後追い承認）→ 巻き戻さない
    if (lastDate && lastDate.getTime() > today.getTime()) return;

    const continued = !!lastDate && lastDate.getTime() === yesterday.getTime();
    newStreak = continued ? streak.currentStreak + 1 : 1;
    oldStreak = continued ? streak.currentStreak : 0;
    newBest = Math.max(newStreak, streak.bestStreak);

    try {
      await prisma.streak.update({
        where: { childId, lastAchievedDate: streak.lastAchievedDate },
        data: { currentStreak: newStreak, bestStreak: newBest, lastAchievedDate: today },
      });
      updated = true;
    } catch (e) {
      if (!isRecordNotFound(e)) throw e;
      // 他の承認が先に更新した → 再読込して判定し直す
    }
  }
  if (!updated) return;

  log.info("Streak updated", { childId, oldStreak, newStreak, newBest });

  // マイルストーンボーナスチェック
  const bonus = getNewMilestoneBonus(oldStreak, newStreak);
  if (bonus > 0) {
    const dist = distributeBonus(bonus);
    // child は関数冒頭で取得済みだが、承認処理でXPが変わっている可能性があるので再取得
    const latestChild = await prisma.user.findUnique({ where: { id: childId } });
    if (latestChild) {
      const newStudy = latestChild.studyPt + dist.study;
      const newStamina = latestChild.staminaPt + dist.stamina;
      const newLife = latestChild.lifePt + dist.life;

      if (latestChild.rebirthPending) {
        // 転生待ち中: XPだけ加算し、進化チェックはスキップ
        await prisma.user.update({
          where: { id: childId },
          data: { studyPt: newStudy, staminaPt: newStamina, lifePt: newLife },
        });
      } else {
        const collectedPaths = JSON.parse(latestChild.collectedPaths) as string[];
        const isReborn = collectedPaths.length > 0;
        let monsterLevels = JSON.parse(latestChild.monsterLevels ?? "{}") as Record<string, number>;

        const evolution = checkEvolution(
          latestChild.evolutionStage,
          latestChild.evolutionPath,
          newStudy,
          newStamina,
          newLife,
          isReborn,
          latestChild.rebirthEggBonus,
        );

        if (evolution.reborn) {
          await prisma.user.update({
            where: { id: childId },
            data: {
              studyPt: newStudy,
              staminaPt: newStamina,
              lifePt: newLife,
              rebirthPending: true,
            },
          });
        } else {
          let newCollectedPaths = collectedPaths;
          if (evolution.evolved) {
            newCollectedPaths = addCollectedPath(collectedPaths, latestChild.monsterSetId, evolution.newPath);
            if (evolution.newStage === 3) {
              monsterLevels = incrementMonsterLevel(monsterLevels, latestChild.monsterSetId, evolution.newPath);
            }
            const evolvedMonster = getMonsterStage(evolution.newStage, evolution.newPath, latestChild.monsterSetId);
            const evolvedName = evolvedMonster?.name ?? evolution.newPath;
            after(() => triggerMonsterEvolvedLog(childId, evolvedName).catch(() => {}));
          }

          await prisma.user.update({
            where: { id: childId },
            data: {
              studyPt: evolution.resetStudy,
              staminaPt: evolution.resetStamina,
              lifePt: evolution.resetLife,
              evolutionStage: evolution.newStage,
              evolutionPath: evolution.newPath,
              collectedPaths: JSON.stringify(newCollectedPaths),
              monsterLevels: JSON.stringify(monsterLevels),
            },
          });
        }
      }

      log.info("Streak milestone bonus", { childId, newStreak, bonus });
      // 新しく達成したマイルストーン称号を掲示板に流す — after() でレスポンス後実行
      const newTitles = STREAK_MILESTONES.filter(m => m.days > oldStreak && m.days <= newStreak);
      for (const m of newTitles) {
        after(() => triggerStreakTitleLog(childId, m.title).catch(() => {}));
      }
    }
  }
}

/**
 * クエスト承認時にタスク別ストリークを記録・更新する。
 * スキップは算入しない（APPROVEDのみ）。
 * repeatDays を踏まえ、「前回出現予定日」と一致した完了であれば連続として +1 する。
 * 例: 月水金 (repeatDays=[1,3,5]) で金曜→月曜は連続扱い（週末は無視）。
 */
export async function recordTaskStreak(
  taskId: string,
  childId: string,
  questDate: Date,
  repeatDays: number[],
) {
  const today = normalizeDate(questDate);
  const prev = previousScheduledDate(repeatDays, today);

  let newStreak = 0;
  let newBest = 0;
  let updated = false;
  for (let attempt = 0; attempt < MAX_OPTIMISTIC_RETRIES && !updated; attempt++) {
    const streak = await prisma.taskStreak.upsert({
      where: { taskId_childId: { taskId, childId } },
      create: { taskId, childId, currentStreak: 0, bestStreak: 0 },
      update: {},
    });
    const lastDate = streak.lastAchievedDate ? normalizeDate(streak.lastAchievedDate) : null;

    // 同日処理済み
    if (lastDate && lastDate.getTime() === today.getTime()) return;
    // 既により新しい日付が記録済み（古い日付の後追い承認）→ 巻き戻さない
    if (lastDate && lastDate.getTime() > today.getTime()) return;

    newStreak =
      lastDate && prev && lastDate.getTime() === prev.getTime()
        ? streak.currentStreak + 1
        : 1;
    newBest = Math.max(newStreak, streak.bestStreak);

    try {
      await prisma.taskStreak.update({
        where: { taskId_childId: { taskId, childId }, lastAchievedDate: streak.lastAchievedDate },
        data: { currentStreak: newStreak, bestStreak: newBest, lastAchievedDate: today },
      });
      updated = true;
    } catch (e) {
      if (!isRecordNotFound(e)) throw e;
    }
  }
  if (!updated) return;

  log.info("Task streak updated", { taskId, childId, newStreak, newBest });
}

const MAX_OPTIMISTIC_RETRIES = 3;

/** 条件付き update が対象 0 件で失敗した（Prisma P2025） */
function isRecordNotFound(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "P2025";
}

/** 日付を UTC 0:00:00 に正規化（TZ非依存） */
function normalizeDate(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

