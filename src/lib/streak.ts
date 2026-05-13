import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkEvolution } from "@/lib/evolution";
import { getMonsterStage } from "@/lib/monsters";
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
            const evolvedMonster = getMonsterStage(evolution.newStage, evolution.newPath, latestChild.side ?? null);
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
              collectedPaths: JSON.stringify(collectedPaths),
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
  const streak = await prisma.taskStreak.upsert({
    where: { taskId_childId: { taskId, childId } },
    create: { taskId, childId, currentStreak: 0, bestStreak: 0 },
    update: {},
  });

  const today = normalizeDate(questDate);
  const lastDate = streak.lastAchievedDate ? normalizeDate(streak.lastAchievedDate) : null;

  // 同日処理済み
  if (lastDate && lastDate.getTime() === today.getTime()) return;

  const prev = previousScheduledDate(repeatDays, today);
  const newStreak =
    lastDate && prev && lastDate.getTime() === prev.getTime()
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

