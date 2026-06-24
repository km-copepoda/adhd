const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** "HH:MM" 形式（00:00〜23:59）を検証する */
export function isValidCheckinDeadlineTime(input: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(input)) return false;
  const [hh, mm] = input.split(":").map(Number);
  if (hh < 0 || hh > 23) return false;
  if (mm < 0 || mm > 59) return false;
  return true;
}

/**
 * 現在時刻が当日の checkinDeadlineTime（JST）より前か。
 * deadline ちょうど（===）は false（期限切れ扱い）。
 */
export function isBeforeCheckinDeadline(
  now: Date,
  questDate: Date,
  deadlineTime: string,
): boolean {
  const [hh, mm] = deadlineTime.split(":").map(Number);
  const startOfJstDayUTC = questDate.getTime() - JST_OFFSET_MS;
  const deadlineUTC = startOfJstDayUTC + hh * 3600000 + mm * 60000;
  return now.getTime() < deadlineUTC;
}

export interface NextStreakInput {
  lastCheckinDate: Date | null;
  today: Date;
  prevStreak: number;
  prevBest: number;
}

export interface NextStreakResult {
  nextStreak: number;
  nextBest: number;
}

/** 成功時のチェックインストリーク計算。失敗時は呼ばずに 0 にリセットする */
export function computeNextCheckinStreak(input: NextStreakInput): NextStreakResult {
  const { lastCheckinDate, today, prevStreak, prevBest } = input;
  const yesterday = new Date(today.getTime() - 86400000);
  const continued =
    lastCheckinDate !== null && lastCheckinDate.getTime() === yesterday.getTime();
  const nextStreak = continued ? prevStreak + 1 : 1;
  const nextBest = Math.max(nextStreak, prevBest);
  return { nextStreak, nextBest };
}
