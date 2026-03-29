import { prisma } from "@/lib/prisma";
import { checkEvolution, distributeBonus } from "@/lib/constants";
import { log } from "@/lib/logger";

export interface LoginActivityResult {
  loginStreak: number;
  loginBestStreak: number;
  bonusGranted: number;
}

/**
 * 子供の日次ログインを記録し、ログインストリークを更新する。
 * 30日倍数ごとに +1pt のボーナスを付与する。
 */
export async function recordLoginActivity(
  childId: string,
  today: Date,
): Promise<LoginActivityResult> {
  const streak = await prisma.streak.upsert({
    where: { childId },
    create: { childId },
    update: {},
  });

  const todayNorm = normalizeDate(today);
  const lastDate = streak.lastLoginDate ? normalizeDate(streak.lastLoginDate) : null;

  // 同日処理済み
  if (lastDate && lastDate.getTime() === todayNorm.getTime()) {
    return {
      loginStreak: streak.loginCurrentStreak,
      loginBestStreak: streak.loginBestStreak,
      bonusGranted: 0,
    };
  }

  const yesterday = new Date(todayNorm);
  yesterday.setDate(yesterday.getDate() - 1);

  const prevStreak =
    lastDate && lastDate.getTime() === yesterday.getTime()
      ? streak.loginCurrentStreak
      : 0;

  const newLoginStreak = prevStreak + 1;
  const newBest = Math.max(newLoginStreak, streak.loginBestStreak);

  await prisma.streak.update({
    where: { childId },
    data: {
      loginCurrentStreak: newLoginStreak,
      loginBestStreak: newBest,
      lastLoginDate: todayNorm,
    },
  });

  log.info("Login streak updated", { childId, prevStreak, newLoginStreak, newBest });

  // 30日倍数ごとにボーナス付与（反復マイルストーン）
  const bonusGranted = getLoginMilestoneBonus(prevStreak, newLoginStreak);
  if (bonusGranted > 0) {
    await applyLoginBonus(childId, bonusGranted);
  }

  return { loginStreak: newLoginStreak, loginBestStreak: newBest, bonusGranted };
}

/** oldStreak→newStreak で新たに到達した30日倍数の回数（通常は0か1） */
function getLoginMilestoneBonus(oldStreak: number, newStreak: number): number {
  const oldMilestone = Math.floor(oldStreak / 30);
  const newMilestone = Math.floor(newStreak / 30);
  return Math.max(0, newMilestone - oldMilestone);
}

async function applyLoginBonus(childId: string, bonus: number): Promise<void> {
  const child = await prisma.user.findUnique({ where: { id: childId } });
  if (!child) return;

  const dist = distributeBonus(bonus);
  const newStudy = child.studyPt + dist.study;
  const newStamina = child.staminaPt + dist.stamina;
  const newLife = child.lifePt + dist.life;

  const evolution = checkEvolution(
    child.evolutionStage,
    child.evolutionPath,
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
      evolutionPath: evolution.newPath,
    },
  });

  log.info("Login streak bonus applied", { childId, bonus, evolved: evolution.evolved });
}

function normalizeDate(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
