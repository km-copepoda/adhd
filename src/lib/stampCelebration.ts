type QuestStub = {
  id: string;
  status: string;
  approvalStamp: string | null;
  template: { title: string };
};

export type StampCelebration = { questId: string; stamp: string; questTitle: string };

/**
 * 前後のクエスト一覧を比較し、新たにスタンプ付き承認されたクエストを全件返す。
 *
 * 注意: prev に存在しないクエスト（初回マウント時のケース）は検知しない。
 * これにより、画面を離れて戻ったときに承認済みクエストの祝福が再表示されるバグを防ぐ。
 */
export function findNewlyStampedApprovals(
  prevQuests: QuestStub[],
  newQuests: QuestStub[],
): StampCelebration[] {
  const prevMap = new Map(prevQuests.map((q) => [q.id, q]));
  const results: StampCelebration[] = [];
  for (const q of newQuests) {
    const prev = prevMap.get(q.id);
    // prev が存在しない（初回マウント or 新規追加）場合は検知しない
    if (q.status === "APPROVED" && q.approvalStamp && prev !== undefined && prev.status !== "APPROVED") {
      results.push({ questId: q.id, stamp: q.approvalStamp, questTitle: q.template.title });
    }
  }
  return results;
}
