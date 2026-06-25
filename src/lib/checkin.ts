import { prisma } from "@/lib/prisma";
import { jstDateOf } from "@/lib/date";
import {
  computeNextCheckinStreak,
  isBeforeCheckinDeadline,
} from "@/lib/checkin.logic";

export interface CheckinResult {
  enabled: boolean;
  deadline: string | null;
  todayStatus: "success" | "fail" | "pending";
  justNow: boolean;
  currentStreak: number;
  bestStreak: number;
}

/**
 * 子供がクエスト画面を開いた瞬間に呼ぶ。
 * - 当日の CheckinLog が存在すれば冪等に既存状態を返す
 * - 締切前の初回呼び出しなら success=true で記録し streak を +1
 * - 締切後の初回呼び出しなら success=false で記録し streak を 0 リセット
 */
export async function recordCheckin(childId: string, now: Date): Promise<CheckinResult> {
  const child = await prisma.user.findUnique({
    where: { id: childId },
    select: { checkinDeadlineTime: true },
  });
  if (!child || !child.checkinDeadlineTime) {
    return {
      enabled: false,
      deadline: null,
      todayStatus: "pending",
      justNow: false,
      currentStreak: 0,
      bestStreak: 0,
    };
  }
  const deadline = child.checkinDeadlineTime;
  const today = jstDateOf(now);

  const existing = await prisma.checkinLog.findUnique({
    where: { childId_date: { childId, date: today } },
  });
  if (existing) {
    const s = await prisma.streak.findUnique({ where: { childId } });
    return {
      enabled: true,
      deadline,
      todayStatus: existing.success ? "success" : "fail",
      justNow: false,
      currentStreak: s?.checkinCurrentStreak ?? 0,
      bestStreak: s?.checkinBestStreak ?? 0,
    };
  }

  const success = isBeforeCheckinDeadline(now, today, deadline);
  const streak = await prisma.streak.upsert({
    where: { childId },
    create: { childId },
    update: {},
  });

  await prisma.checkinLog.create({
    data: {
      childId,
      date: today,
      success,
      checkedInAt: success ? now : null,
    },
  });

  let nextStreak: number;
  let nextBest: number;
  let nextLast: Date | null;
  if (success) {
    const r = computeNextCheckinStreak({
      lastCheckinDate: streak.lastCheckinDate ?? null,
      today,
      prevStreak: streak.checkinCurrentStreak,
      prevBest: streak.checkinBestStreak,
    });
    nextStreak = r.nextStreak;
    nextBest = r.nextBest;
    nextLast = today;
  } else {
    nextStreak = 0;
    nextBest = streak.checkinBestStreak;
    nextLast = streak.lastCheckinDate ?? null;
  }

  await prisma.streak.update({
    where: { childId },
    data: {
      checkinCurrentStreak: nextStreak,
      checkinBestStreak: nextBest,
      lastCheckinDate: nextLast,
    },
  });

  return {
    enabled: true,
    deadline,
    todayStatus: success ? "success" : "fail",
    justNow: success,
    currentStreak: nextStreak,
    bestStreak: nextBest,
  };
}
