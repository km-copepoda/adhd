import { prisma } from "@/lib/prisma";
import { checkEvolution } from "@/lib/evolution";
import { getNewMilestoneBonus, distributeBonus, STREAK_MILESTONES } from "@/lib/streakMilestones";
import { log } from "@/lib/logger";
import { triggerStreakTitleLog } from "@/lib/bulletinLog";

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

  // 既存 Streak レコード取得（なければデフォルト値で作成）
  const streak = await prisma.streak.upsert({
    where: { childId },
    create: { childId, currentStreak: 0, bestStreak: 0 },
    update: {},
  });

  const today = normalizeDate(questDate);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const lastDate = streak.lastAchievedDate ? normalizeDate(streak.lastAchievedDate) : null;

  // 同日処理済み
  if (lastDate && lastDate.getTime() === today.getTime()) return;

  let newStreak: number;

  if (lastDate && lastDate.getTime() === yesterday.getTime()) {
    // 昨日も達成 → 連続
    newStreak = streak.currentStreak + 1;
  } else {
    // 途切れた or 初回
    newStreak = 1;
  }

  const oldStreak = lastDate && lastDate.getTime() === yesterday.getTime() ? streak.currentStreak : 0;
  const newBest = Math.max(newStreak, streak.bestStreak);

  // ストリーク更新
  await prisma.streak.update({
    where: { childId },
    data: {
      currentStreak: newStreak,
      bestStreak: newBest,
      lastAchievedDate: today,
    },
  });

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
        const monsterLevels = JSON.parse(latestChild.monsterLevels ?? "{}") as Record<string, number>;

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
          if (evolution.evolved) {
            if (!collectedPaths.includes(evolution.newPath)) {
              collectedPaths.push(evolution.newPath);
            }
            if (evolution.newStage === 3) {
              monsterLevels[evolution.newPath] = (monsterLevels[evolution.newPath] ?? 0) + 1;
            }
          }

          await prisma.user.update({
            where: { id: childId },
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

      log.info("Streak milestone bonus", { childId, newStreak, bonus });
      // 新しく達成したマイルストーン称号を掲示板に流す（fire-and-forget）
      const newTitles = STREAK_MILESTONES.filter(m => m.days > oldStreak && m.days <= newStreak);
      for (const m of newTitles) {
        triggerStreakTitleLog(childId, m.title).catch(() => {});
      }
    }
  }
}

/**
 * クエスト承認時にタスク別ストリークを記録・更新する。
 * スキップは算入しない（APPROVEDのみ）。
 */
export async function recordTaskStreak(taskId: string, childId: string, questDate: Date) {
  const streak = await prisma.taskStreak.upsert({
    where: { taskId_childId: { taskId, childId } },
    create: { taskId, childId, currentStreak: 0, bestStreak: 0 },
    update: {},
  });

  const today = normalizeDate(questDate);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const lastDate = streak.lastAchievedDate ? normalizeDate(streak.lastAchievedDate) : null;

  // 同日処理済み
  if (lastDate && lastDate.getTime() === today.getTime()) return;

  const newStreak =
    lastDate && lastDate.getTime() === yesterday.getTime()
      ? streak.currentStreak + 1
      : 1;

  const newBest = Math.max(newStreak, streak.bestStreak);
  await prisma.taskStreak.update({
    where: { taskId_childId: { taskId, childId } },
    data: {
      currentStreak: newStreak,
      bestStreak: newBest,
      lastAchievedDate: today,
    },
  });
  
  log.info("Task streak updated", { taskId, childId, newStreak, newBest });
}

/** 日付を UTC 0:00:00 に正規化（TZ非依存） */
function normalizeDate(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

