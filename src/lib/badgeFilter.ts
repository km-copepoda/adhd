export type BadgeData = {
  id: string;
  name: string;
  emoji: string;
  description: string;
  unlocked: boolean;
  unlockedAt: string | null;
  isNew: boolean;
  /** 数値系バッジの進捗。ブール系・未解錠以外は null。 */
  progress?: { current: number; target: number } | null;
};

export type BadgeFilter = "all" | "unlocked" | "locked";

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * バッジが「当日 JST」に解除されたかどうかを返す。
 * @param unlockedAt DB から取得した解除日時文字列（UTC）
 * @param nowMs      現在時刻のミリ秒（テスト用に差し替え可能、デフォルトは Date.now()）
 */
export function isBadgeNew(unlockedAt: string | null, nowMs = Date.now()): boolean {
  if (!unlockedAt) return false;
  const todayJST = new Date(nowMs + JST_OFFSET_MS).toISOString().slice(0, 10);
  const dateJST = new Date(new Date(unlockedAt).getTime() + JST_OFFSET_MS).toISOString().slice(0, 10);
  return todayJST === dateJST;
}

/**
 * バッジ一覧をフィルタリングし、新着優先でソートして返す。
 * 優先順位: NEW（新着解除） > 解除済み > 未解除
 */
export function sortAndFilterBadges(
  badges: BadgeData[],
  filter: BadgeFilter
): BadgeData[] {
  const filtered = badges.filter(b => {
    if (filter === "unlocked") return b.unlocked;
    if (filter === "locked") return !b.unlocked;
    return true;
  });

  return [...filtered].sort((a, b) => {
    const rankA = a.isNew ? 0 : a.unlocked ? 1 : 2;
    const rankB = b.isNew ? 0 : b.unlocked ? 1 : 2;
    return rankA - rankB;
  });
}
