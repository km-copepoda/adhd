export type BadgeData = {
  id: string;
  name: string;
  emoji: string;
  description: string;
  unlocked: boolean;
  unlockedAt: string | null;
  isNew: boolean;
};

export type BadgeFilter = "all" | "unlocked" | "locked" | "new";

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
    if (filter === "new") return b.isNew;
    return true;
  });

  return [...filtered].sort((a, b) => {
    const rankA = a.isNew ? 0 : a.unlocked ? 1 : 2;
    const rankB = b.isNew ? 0 : b.unlocked ? 1 : 2;
    return rankA - rankB;
  });
}
