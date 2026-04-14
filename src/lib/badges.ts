import { prisma } from "@/lib/prisma";
import { ALL_BADGES, checkBadgeConditions } from "@/lib/badges.data";
import type { Badge, BadgeContext } from "@/lib/badges.data";

// Re-export types and data for consumers
export { ALL_BADGES, checkBadgeConditions } from "@/lib/badges.data";
export type { Badge, BadgeContext } from "@/lib/badges.data";

// ─── ISO週キー計算 ────────────────────────────────────────────────────────

function getISOWeekKey(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  const dayOfWeek = d.getUTCDay() || 7; // Mon=1..Sun=7
  d.setUTCDate(d.getUTCDate() + 4 - dayOfWeek); // 最寄りの木曜日
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

// ─── DB からコンテキストを構築 ────────────────────────────────────────────

export async function loadBadgeContext(childId: string): Promise<BadgeContext> {
  const JST_OFFSET = 9 * 60 * 60 * 1000;

  const [user, streakData, allQuests, taskStreaks, selfTaskApprovedCount, selfTaskCreatedCount, unlockedBadgeCount] =
    await Promise.all([
      prisma.user.findUnique({
        where: { id: childId },
        select: {
          evolutionStage: true,
          collectedPaths: true,
          studyPt: true,
          staminaPt: true,
          lifePt: true,
        },
      }),
      prisma.streak.findUnique({
        where: { childId },
        select: {
          currentStreak: true,
          bestStreak: true,
          loginCurrentStreak: true,
          loginBestStreak: true,
        },
      }),
      prisma.questInstance.findMany({
        where: { childId },
        select: {
          id: true,
          date: true,
          status: true,
          photoUrl: true,
          deadlineBonusEarned: true,
          rejectionReason: true,
          reportedAt: true,
          createdAt: true,
          template: { select: { photoBonus: true } },
        },
        orderBy: { date: "asc" },
      }),
      prisma.taskStreak.findMany({
        where: { childId },
        select: { bestStreak: true },
      }),
      // 自分で作成して親に承認されたタスク数
      prisma.taskTemplate.count({
        where: {
          assignedChildId: childId,
          originalCreatedBy: "CHILD",
          createdBy: "PARENT",
        },
      }),
      // 自分で作成したタスク数（承認待ち含む）
      prisma.taskTemplate.count({
        where: {
          assignedChildId: childId,
          originalCreatedBy: "CHILD",
        },
      }),
      prisma.userBadge.count({ where: { userId: childId } }),
    ]);

  if (!user) throw new Error(`User ${childId} not found`);

  // コレクション解析
  const collectedPathsList = JSON.parse(user.collectedPaths || "[]") as string[];
  const rebirthCount = Math.max(0, Math.floor((collectedPathsList.length - 1) / 3));
  const hasStudyCollection = collectedPathsList.some(p => p.startsWith("STUDY"));
  const hasStaminaCollection = collectedPathsList.some(p => p.startsWith("STAMINA"));
  const hasLifeCollection = collectedPathsList.some(p => p.startsWith("LIFE"));

  // ステータス別分類
  const approvedQuests = allQuests.filter(q => q.status === "APPROVED");
  const skippedQuests = allQuests.filter(q => q.status === "SKIPPED");

  const approvedCount = approvedQuests.length;
  const photoCount = approvedQuests.filter(q => q.photoUrl).length;
  const deadlineBonusCount = approvedQuests.filter(q => q.deadlineBonusEarned).length;
  const skipCount = skippedQuests.length;
  const retrySuccessCount = approvedQuests.filter(q => q.rejectionReason).length;

  // 累計XP: 承認済みクエストから生涯獲得XPを算出（進化・転生でリセットされない）
  let totalLifetimeXp = 0;
  for (const q of approvedQuests) {
    totalLifetimeXp += 1;
    if (q.deadlineBonusEarned) totalLifetimeXp++;
    if (q.template.photoBonus && q.photoUrl) totalLifetimeXp++;
  }

  // 速報: 30分以内の報告（createdAt → reportedAt）
  const quickReportCount = approvedQuests.filter(q => {
    if (!q.reportedAt || !q.createdAt) return false;
    return q.reportedAt.getTime() - q.createdAt.getTime() < 30 * 60 * 1000;
  }).length;

  // 時間帯別: JST 換算
  const morningReportCount = approvedQuests.filter(q => {
    if (!q.reportedAt) return false;
    const jstHour = new Date(q.reportedAt.getTime() + JST_OFFSET).getUTCHours();
    return jstHour < 8;
  }).length;

  const afternoonReportCount = approvedQuests.filter(q => {
    if (!q.reportedAt) return false;
    const jstHour = new Date(q.reportedAt.getTime() + JST_OFFSET).getUTCHours();
    return jstHour >= 15 && jstHour < 18;
  }).length;

  // 日付別グループ化
  const todayStr = new Date(Date.now() + JST_OFFSET).toISOString().split("T")[0];

  const approvedByDate = new Map<string, typeof approvedQuests>();
  for (const q of approvedQuests) {
    const dateStr = q.date.toISOString().split("T")[0];
    if (!approvedByDate.has(dateStr)) approvedByDate.set(dateStr, []);
    approvedByDate.get(dateStr)!.push(q);
  }

  const allByDate = new Map<string, typeof allQuests>();
  for (const q of allQuests) {
    const dateStr = q.date.toISOString().split("T")[0];
    if (!allByDate.has(dateStr)) allByDate.set(dateStr, []);
    allByDate.get(dateStr)!.push(q);
  }

  // パーフェクトデイ: 過去の日付で全クエストが APPROVED または SKIPPED
  let perfectDaysCount = 0;
  for (const [dateStr, quests] of allByDate) {
    if (dateStr >= todayStr) continue;
    if (quests.length > 0 && quests.every(q => q.status === "APPROVED" || q.status === "SKIPPED")) {
      perfectDaysCount++;
    }
  }

  const maxQuestsPerDay = Math.max(0, ...[...approvedByDate.values()].map(qs => qs.length));
  const approvedDates = [...approvedByDate.keys()].sort();

  // スキップ翌日達成
  const skippedDates = new Set(skippedQuests.map(q => q.date.toISOString().split("T")[0]));
  const approvedDatesSet = new Set(approvedDates);
  let skipThenNextDayCount = 0;
  for (const dateStr of skippedDates) {
    const next = new Date(dateStr + "T00:00:00Z");
    next.setUTCDate(next.getUTCDate() + 1);
    if (approvedDatesSet.has(next.toISOString().split("T")[0])) {
      skipThenNextDayCount++;
    }
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
  const springDatesSet = new Set<string>();
  const summerDatesSet = new Set<string>();
  const autumnDatesSet = new Set<string>();
  const winterDatesSet = new Set<string>();
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

    if (month === 4) springDatesSet.add(dateStr);
    if (month === 7 || month === 8) summerDatesSet.add(dateStr);
    if (month === 9 || month === 10) autumnDatesSet.add(dateStr);
    if (month === 12 || month === 1) winterDatesSet.add(dateStr);
    if (month === 1 && day <= 3) hasNewYearQuest = true;
    if (day >= daysInThisMonth - 2) monthEndCount++;
    if (dayOfWeek === 1) mondayCount++;
    if (dayOfWeek === 0 || dayOfWeek === 6) weekendCount++;
  }

  // 複合チャレンジ
  let hasMagicDay = false;
  let tripleCrownDaysCount = 0;
  for (const quests of approvedByDate.values()) {
    const hasDeadline = quests.some(q => q.deadlineBonusEarned);
    const hasPhoto = quests.some(q => q.photoUrl);
    if (hasDeadline && hasPhoto) {
      hasMagicDay = true;
      tripleCrownDaysCount++;
    }
  }

  // スピードスター: 1週間で毎日期限ボーナス（週7日すべての曜日）
  const deadlineByWeek = new Map<string, Set<number>>();
  for (const q of approvedQuests.filter(q => q.deadlineBonusEarned)) {
    const dateStr = q.date.toISOString().split("T")[0];
    const weekKey = getISOWeekKey(dateStr);
    const dow = new Date(dateStr + "T00:00:00Z").getUTCDay();
    if (!deadlineByWeek.has(weekKey)) deadlineByWeek.set(weekKey, new Set());
    deadlineByWeek.get(weekKey)!.add(dow);
  }
  const hasWeekWithDailyDeadline = [...deadlineByWeek.values()].some(days => days.size >= 7);

  // カムバックストリーク計算
  const { segments, breaks } = computeStreakSegments(approvedDates);
  const postBreakMax = segments.length > 1 ? Math.max(...segments.slice(1)) : 0;
  const hasComeback7 = breaks >= 1 && postBreakMax >= 7;
  const hasComeback14 = breaks >= 1 && postBreakMax >= 14;
  const hasComeback7After2Breaks = breaks >= 2 && postBreakMax >= 7;

  return {
    evolutionStage: user.evolutionStage,
    rebirthCount,
    totalXp: totalLifetimeXp,
    collectionCount: collectedPathsList.length,
    hasStudyCollection,
    hasStaminaCollection,
    hasLifeCollection,
    hasAllTypesCollection: hasStudyCollection && hasStaminaCollection && hasLifeCollection,
    bestTaskStreak: Math.max(streakData?.bestStreak ?? 0, streakData?.currentStreak ?? 0),
    loginCurrentStreak: streakData?.loginCurrentStreak ?? 0,
    loginBestStreak: streakData?.loginBestStreak ?? 0,
    approvedCount,
    photoCount,
    deadlineBonusCount,
    quickReportCount,
    morningReportCount,
    afternoonReportCount,
    retrySuccessCount,
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
    springDays: springDatesSet.size,
    summerDays: summerDatesSet.size,
    autumnDays: autumnDatesSet.size,
    winterDays: winterDatesSet.size,
    hasNewYearQuest,
    monthEndCount,
    mondayCount,
    weekendCount,
    selfTaskCreatedCount,
    selfTaskApprovedCount,
    maxSingleTaskBestStreak: Math.max(0, ...taskStreaks.map(t => t.bestStreak)),
    hasComeback7,
    hasComeback14,
    hasComeback7After2Breaks,
    hasMagicDay,
    hasWeekWithDailyDeadline,
    tripleCrownDaysCount,
    unlockedBadgeCount,
  };
}

/**
 * 連続日数のセグメントとブレーク数を計算する。
 * segments[0] が最初のストリーク、segments[1] 以降が各カムバック。
 */
function computeStreakSegments(
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

// ─── メイン: バッジ解除チェックと保存 ────────────────────────────────────

/**
 * childId の現在状態を確認し、新たに解除されたバッジを DB に保存して返す。
 */
export async function checkAndUnlockBadges(childId: string): Promise<Badge[]> {
  const [ctx, alreadyUnlocked] = await Promise.all([
    loadBadgeContext(childId),
    prisma.userBadge.findMany({
      where: { userId: childId },
      select: { badgeId: true },
    }),
  ]);

  const alreadyUnlockedIds = new Set(alreadyUnlocked.map(b => b.badgeId));
  const shouldEarn = checkBadgeConditions(ctx);

  const newBadgeIds = [...shouldEarn].filter(id => !alreadyUnlockedIds.has(id));
  if (newBadgeIds.length === 0) return [];

  await prisma.userBadge.createMany({
    data: newBadgeIds.map(badgeId => ({ userId: childId, badgeId })),
    skipDuplicates: true,
  });

  const badgeMap = new Map(ALL_BADGES.map(b => [b.id, b]));
  return newBadgeIds.map(id => badgeMap.get(id)!).filter(Boolean);
}
