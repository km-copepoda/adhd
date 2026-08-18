import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkEvolution } from "@/lib/evolution";
import { getMonsterStage } from "@/lib/monsters";
import { addCollectedPath } from "@/lib/monsterThemes/collectedPaths";
import { triggerMonsterEvolvedLog } from "@/lib/bulletinLog";
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

/** oldStreak→newStreak で新たに到達した10日倍数の回数（通常は0か1） */
function getLoginMilestoneBonus(oldStreak: number, newStreak: number): number {
  const oldMilestone = Math.floor(oldStreak / 10);
  const newMilestone = Math.floor(newStreak / 10);
  return Math.max(0, newMilestone - oldMilestone);
}

async function applyLoginBonus(childId: string, bonus: number): Promise<void> {
  const child = await prisma.user.findUnique({ where: { id: childId } });
  if (!child) return;

  const { newStudy, newStamina, newLife } = addBonusToMinCategory(
    child.studyPt,
    child.staminaPt,
    child.lifePt,
    bonus,
  );

  if (child.rebirthPending) {
    // 転生待ち中: XPだけ加算し、進化チェックはスキップ
    await prisma.user.update({
      where: { id: childId },
      data: { studyPt: newStudy, staminaPt: newStamina, lifePt: newLife },
    });
    log.info("Login streak bonus applied (rebirth pending, XP only)", { childId, bonus });
    return;
  }

  const collectedPaths = JSON.parse(child.collectedPaths) as string[];
  const isReborn = collectedPaths.length > 0;
  const monsterLevels = JSON.parse(child.monsterLevels ?? "{}") as Record<string, number>;

  const evolution = checkEvolution(
    child.evolutionStage,
    child.evolutionPath,
    newStudy,
    newStamina,
    newLife,
    isReborn,
    child.rebirthEggBonus,
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
      newCollectedPaths = addCollectedPath(collectedPaths, child.monsterSetId, evolution.newPath);
      if (evolution.newStage === 3) {
        monsterLevels[evolution.newPath] = (monsterLevels[evolution.newPath] ?? 0) + 1;
      }
      const evolvedMonster = getMonsterStage(evolution.newStage, evolution.newPath, child.monsterSetId);
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

  log.info("Login streak bonus applied", { childId, bonus, evolved: evolution.evolved });
}

/** ボーナスを最少ポイントのカテゴリに加算する（同値の場合 STUDY > STAMINA > LIFE） */
function addBonusToMinCategory(
  study: number,
  stamina: number,
  life: number,
  bonus: number,
): { newStudy: number; newStamina: number; newLife: number } {
  const min = Math.min(study, stamina, life);
  if (study === min) return { newStudy: study + bonus, newStamina: stamina, newLife: life };
  if (stamina === min) return { newStudy: study, newStamina: stamina + bonus, newLife: life };
  return { newStudy: study, newStamina: stamina, newLife: life + bonus };
}

function normalizeDate(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
