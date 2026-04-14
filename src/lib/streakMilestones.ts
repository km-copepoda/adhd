// ─── ストリーク ──────────────────────────────────────
export const STREAK_MILESTONES = [
  { days: 3, title: "はじめの一歩", emoji: "🔥", bonusPt: 5 },
  { days: 7, title: "一週間の戦士", emoji: "⚔️", bonusPt: 10 },
  { days: 30, title: "月の修行者", emoji: "🌙", bonusPt: 20 },
  { days: 100, title: "伝説の冒険者", emoji: "👑", bonusPt: 30 },
] as const;

/** 現在のストリークに対応する称号（未達成なら null） */
export function getStreakTitle(currentStreak: number) {
  let best: (typeof STREAK_MILESTONES)[number] | null = null;
  for (const m of STREAK_MILESTONES) {
    if (currentStreak >= m.days) best = m;
  }
  return best;
}

/** 現在のストリーク数で達成済みだが未読（seenTitles に含まれない）の実績リストを返す */
export function getUnreadAchievements(
  currentStreak: number,
  seenTitles: string[]
): (typeof STREAK_MILESTONES)[number][] {
  return STREAK_MILESTONES.filter(
    (m) => m.days <= currentStreak && !seenTitles.includes(m.title)
  );
}

/** oldStreak→newStreak で新たに到達したマイルストーンのボーナス合計を返す */
export function getNewMilestoneBonus(oldStreak: number, newStreak: number): number {
  let bonus = 0;
  for (const m of STREAK_MILESTONES) {
    if (oldStreak < m.days && newStreak >= m.days) bonus += m.bonusPt;
  }
  return bonus;
}

/**
 * 前回訪問時に保存した称号名と現在の称号名を比較し、
 * 新たに解除されたマイルストーンを返す。
 * - lastSeenTitle === null: 初回訪問 → 表示不要（null を返す）
 * - currentTitle が lastSeenTitle と異なる → 新称号解除（マイルストーンを返す）
 */
export function getNewlyUnlockedMilestone(
  lastSeenTitle: string | null,
  currentTitle: string | null
): (typeof STREAK_MILESTONES)[number] | null {
  if (lastSeenTitle === null || !currentTitle || currentTitle === lastSeenTitle) return null;
  return STREAK_MILESTONES.find((m) => m.title === currentTitle) ?? null;
}

/** ボーナスptを3カテゴリ均等分配（端数は STUDY に加算） */
export function distributeBonus(bonus: number): { study: number; stamina: number; life: number } {
  const base = Math.floor(bonus / 3);
  const remainder = bonus - base * 3;
  return { study: base + remainder, stamina: base, life: base };
}

// ─── タブバッジ表示判定 ─────────────────────────────

/**
 * 育成タブのバッジ表示判定。
 * lastSeenStage が null（未訪問）なら false。
 * 現在のステージが前回表示時より進んでいる場合 true。
 */
export function shouldShowMonsterBadge(
  currentStage: number,
  lastSeenStage: string | null
): boolean {
  if (lastSeenStage === null) return false;
  return currentStage > parseInt(lastSeenStage, 10);
}

/**
 * 図鑑タブのバッジ表示判定。
 * lastSeenCount が null（未訪問）なら false。
 * コレクション数が前回表示時より増えた場合 true。
 */
export function shouldShowZukanBadge(
  currentCount: number,
  lastSeenCount: string | null
): boolean {
  if (lastSeenCount === null) return false;
  return currentCount > parseInt(lastSeenCount, 10);
}

/**
 * 実績タブのバッジ件数を返す。
 * lastSeenCount が null（未訪問）なら 0。
 * 解除済み件数が前回確認時より増えた分を返す（負にはならない）。
 */
export function getNewBadgeCount(
  unlockedCount: number,
  lastSeenCount: string | null
): number {
  if (lastSeenCount === null) return 0;
  const seen = parseInt(lastSeenCount, 10);
  if (isNaN(seen)) return 0;
  return Math.max(0, unlockedCount - seen);
}
