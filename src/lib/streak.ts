import { prisma } from "@/lib/prisma";
import { checkEvolution, getNewMilestoneBonus, distributeBonus } from "@/lib/constants";
import type { Side } from "@/types";

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
  const twoDaysAgo = new Date(today);
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

  const lastDate = streak.lastAchievedDate ? normalizeDate(streak.lastAchievedDate) : null;

  // 同日処理済み
  if (lastDate && lastDate.getTime() === today.getTime()) return;

  let newStreak: number;

  if (lastDate && lastDate.getTime() === yesterday.getTime()) {
    // 昨日も達成 → 連続
    newStreak = streak.currentStreak + 1;
  } else if (
    lastDate &&
    lastDate.getTime() === twoDaysAgo.getTime() &&
    streak.restPassUsedAt &&
    isInSameWeek(normalizeDate(streak.restPassUsedAt), yesterday)
  ) {
    // 2日前が最終達成日で、昨日に休息券を使っている → 途切れない
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

      const evolution = checkEvolution(
        (latestChild.side || "LIGHT") as Side,
        latestChild.evolutionStage,
        newStudy,
        newStamina,
        newLife,
      );

      await prisma.user.update({
        where: { id: childId },
        data: {
          studyPt: evolution.resetStudy,
          staminaPt: evolution.resetStamina,
          lifePt: evolution.resetLife,
          evolutionStage: evolution.newStage,
        },
      });
    }
  }
}

/** 日付を UTC 0:00:00 に正規化（TZ非依存） */
function normalizeDate(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** 2つの日付が同じ週（月曜起算・UTC）かどうか */
function isInSameWeek(a: Date, b: Date): boolean {
  const getMonday = (d: Date) => {
    const day = d.getUTCDay();
    const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), diff));
  };
  return getMonday(a).getTime() === getMonday(b).getTime();
}
