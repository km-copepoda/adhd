import type { BadgeContext } from "@/lib/badges.data";

// QuestInstance 由来のバッジ集計（純粋関数）。
// DB 側で集計済みの「日付別件数」と「スカラー値」だけを受け取り、BadgeContext の該当項目を返す。

export type QuestDateRow = {
  /** YYYY-MM-DD（@db.Date を UTC 0:00 の JST 日付として読んだもの） */
  date: string;
  total: number;
  approved: number;
  skipped: number;
  approvedDeadline: number;
  approvedPhoto: number;
};

export type QuestScalars = {
  retrySuccessCount: number;
  photoBonusXpCount: number;
  quickReportCount: number;
  morningReportCount: number;
  afternoonReportCount: number;
};

export type QuestBadgeStats = Pick<
  BadgeContext,
  | "totalXp"
  | "approvedCount"
  | "photoCount"
  | "deadlineBonusCount"
  | "quickReportCount"
  | "morningReportCount"
  | "afternoonReportCount"
  | "retrySuccessCount"
  | "skipCount"
  | "skipThenNextDayCount"
  | "perfectDaysCount"
  | "maxQuestsPerDay"
  | "weeksWithFivePlusDays"
  | "weeksWithSevenDays"
  | "monthsWithTenPlusDays"
  | "monthsWithFifteenPlusDays"
  | "monthsWithTwentyPlusDays"
  | "perfectMonthsCount"
  | "springDays"
  | "summerDays"
  | "autumnDays"
  | "winterDays"
  | "hasNewYearQuest"
  | "monthEndCount"
  | "mondayCount"
  | "weekendCount"
  | "hasComeback7"
  | "hasComeback14"
  | "hasComeback7After2Breaks"
  | "hasMagicDay"
  | "hasWeekWithDailyDeadline"
  | "tripleCrownDaysCount"
>;

// ─── ISO週キー計算 ────────────────────────────────────────────────────────

export function getISOWeekKey(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  const dayOfWeek = d.getUTCDay() || 7; // Mon=1..Sun=7
  d.setUTCDate(d.getUTCDate() + 4 - dayOfWeek); // 最寄りの木曜日
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

/**
 * 連続日数のセグメントとブレーク数を計算する。
 * segments[0] が最初のストリーク、segments[1] 以降が各カムバック。
 */
export function computeStreakSegments(
  sortedDates: string[],
): { segments: number[]; breaks: number } {
  if (sortedDates.length === 0) return { segments: [], breaks: 0 };

  const deduped = [...new Set(sortedDates)].sort();
  const segments: number[] = [];
  let current = 1;
  let breaks = 0;

  for (let i = 1; i < deduped.length; i++) {
    const prev = new Date(deduped[i - 1] + "T00:00:00Z");
    const curr = new Date(deduped[i] + "T00:00:00Z");
    const diffDays = Math.round((curr.getTime() - prev.getTime()) / 86400000);
    if (diffDays === 1) {
      current++;
    } else {
      segments.push(current);
      breaks++;
      current = 1;
    }
  }
  segments.push(current);
  return { segments, breaks };
}

// ─── メイン ───────────────────────────────────────────────────────────────

export function buildQuestBadgeStats(
  perDateRows: QuestDateRow[],
  scalars: QuestScalars,
  todayStr: string,
): QuestBadgeStats {
  let approvedCount = 0;
  let skipCount = 0;
  let deadlineBonusCount = 0;
  let photoCount = 0;
  let perfectDaysCount = 0;
  let maxQuestsPerDay = 0;

  const approvedRows = perDateRows.filter(r => r.approved > 0);
  for (const r of perDateRows) {
    approvedCount += r.approved;
    skipCount += r.skipped;
    deadlineBonusCount += r.approvedDeadline;
    photoCount += r.approvedPhoto;
    if (r.approved > maxQuestsPerDay) maxQuestsPerDay = r.approved;
    // パーフェクトデイ: 過去の日付で全クエストが APPROVED または SKIPPED
    if (r.date < todayStr && r.total > 0 && r.total === r.approved + r.skipped) perfectDaysCount++;
  }

  // 累計XP: 承認 + 期限ボーナス + 写真ボーナス（進化・転生でリセットされない生涯XP）
  const totalXp = approvedCount + deadlineBonusCount + scalars.photoBonusXpCount;

  const approvedDates = approvedRows.map(r => r.date).sort();

  // スキップ翌日達成
  const skippedDates = new Set(perDateRows.filter(r => r.skipped > 0).map(r => r.date));
  const approvedDatesSet = new Set(approvedDates);
  let skipThenNextDayCount = 0;
  for (const dateStr of skippedDates) {
    const next = new Date(dateStr + "T00:00:00Z");
    next.setUTCDate(next.getUTCDate() + 1);
    if (approvedDatesSet.has(next.toISOString().split("T")[0])) skipThenNextDayCount++;
  }

  // 週次集計
  const approvedDatesByWeek = new Map<string, Set<string>>();
  for (const dateStr of approvedDates) {
    const weekKey = getISOWeekKey(dateStr);
    if (!approvedDatesByWeek.has(weekKey)) approvedDatesByWeek.set(weekKey, new Set());
    approvedDatesByWeek.get(weekKey)!.add(dateStr);
  }
  let weeksWithFivePlusDays = 0;
  let weeksWithSevenDays = 0;
  for (const days of approvedDatesByWeek.values()) {
    if (days.size >= 5) weeksWithFivePlusDays++;
    if (days.size >= 7) weeksWithSevenDays++;
  }

  // 月次集計
  const approvedDatesByMonth = new Map<string, Set<string>>();
  for (const dateStr of approvedDates) {
    const monthKey = dateStr.slice(0, 7);
    if (!approvedDatesByMonth.has(monthKey)) approvedDatesByMonth.set(monthKey, new Set());
    approvedDatesByMonth.get(monthKey)!.add(dateStr);
  }
  let monthsWithTenPlusDays = 0;
  let monthsWithFifteenPlusDays = 0;
  let monthsWithTwentyPlusDays = 0;
  let perfectMonthsCount = 0;
  for (const [monthKey, days] of approvedDatesByMonth) {
    const [year, month] = monthKey.split("-").map(Number);
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    if (days.size >= 10) monthsWithTenPlusDays++;
    if (days.size >= 15) monthsWithFifteenPlusDays++;
    if (days.size >= 20) monthsWithTwentyPlusDays++;
    if (days.size >= daysInMonth) perfectMonthsCount++;
  }

  // 季節・曜日別集計
  let springDays = 0;
  let summerDays = 0;
  let autumnDays = 0;
  let winterDays = 0;
  let hasNewYearQuest = false;
  let monthEndCount = 0;
  let mondayCount = 0;
  let weekendCount = 0;

  for (const dateStr of approvedDates) {
    const d = new Date(dateStr + "T00:00:00Z");
    const month = d.getUTCMonth() + 1;
    const day = d.getUTCDate();
    const dayOfWeek = d.getUTCDay();
    const daysInThisMonth = new Date(Date.UTC(d.getUTCFullYear(), month, 0)).getUTCDate();

    if (month === 4) springDays++;
    if (month === 7 || month === 8) summerDays++;
    if (month === 9 || month === 10) autumnDays++;
    if (month === 12 || month === 1) winterDays++;
    if (month === 1 && day <= 3) hasNewYearQuest = true;
    if (day >= daysInThisMonth - 2) monthEndCount++;
    if (dayOfWeek === 1) mondayCount++;
    if (dayOfWeek === 0 || dayOfWeek === 6) weekendCount++;
  }

  // 複合チャレンジ: 同じ日に期限ボーナスと写真の両方がある承認日
  let tripleCrownDaysCount = 0;
  for (const r of approvedRows) {
    if (r.approvedDeadline > 0 && r.approvedPhoto > 0) tripleCrownDaysCount++;
  }
  const hasMagicDay = tripleCrownDaysCount > 0;

  // スピードスター: 1週間で毎日期限ボーナス（週7日すべての曜日）
  const deadlineByWeek = new Map<string, Set<number>>();
  for (const r of approvedRows) {
    if (r.approvedDeadline === 0) continue;
    const weekKey = getISOWeekKey(r.date);
    const dow = new Date(r.date + "T00:00:00Z").getUTCDay();
    if (!deadlineByWeek.has(weekKey)) deadlineByWeek.set(weekKey, new Set());
    deadlineByWeek.get(weekKey)!.add(dow);
  }
  const hasWeekWithDailyDeadline = [...deadlineByWeek.values()].some(days => days.size >= 7);

  // カムバックストリーク計算
  const { segments, breaks } = computeStreakSegments(approvedDates);
  const postBreakMax = segments.length > 1 ? Math.max(...segments.slice(1)) : 0;

  return {
    totalXp,
    approvedCount,
    photoCount,
    deadlineBonusCount,
    quickReportCount: scalars.quickReportCount,
    morningReportCount: scalars.morningReportCount,
    afternoonReportCount: scalars.afternoonReportCount,
    retrySuccessCount: scalars.retrySuccessCount,
    skipCount,
    skipThenNextDayCount,
    perfectDaysCount,
    maxQuestsPerDay,
    weeksWithFivePlusDays,
    weeksWithSevenDays,
    monthsWithTenPlusDays,
    monthsWithFifteenPlusDays,
    monthsWithTwentyPlusDays,
    perfectMonthsCount,
    springDays,
    summerDays,
    autumnDays,
    winterDays,
    hasNewYearQuest,
    monthEndCount,
    mondayCount,
    weekendCount,
    hasComeback7: breaks >= 1 && postBreakMax >= 7,
    hasComeback14: breaks >= 1 && postBreakMax >= 14,
    hasComeback7After2Breaks: breaks >= 2 && postBreakMax >= 7,
    hasMagicDay,
    hasWeekWithDailyDeadline,
    tripleCrownDaysCount,
  };
}
