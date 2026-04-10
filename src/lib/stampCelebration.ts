type QuestStub = {
  id: string;
  status: string;
  approvalStamp: string | null;
  template: { title: string };
};

/**
 * 前後のクエスト一覧を比較し、新たにスタンプ付き承認されたクエストを返す。
 * 複数ある場合は最初の1件のみ返す（一度に1つの祝福を表示）。
 *
 * 注意: prev に存在しないクエスト（初回マウント時のケース）は検知しない。
 * これにより、画面を離れて戻ったときに承認済みクエストの祝福が再表示されるバグを防ぐ。
 */
export function findNewlyStampedApproval(
  prevQuests: QuestStub[],
  newQuests: QuestStub[],
): { questId: string; stamp: string; questTitle: string } | null {
  const prevMap = new Map(prevQuests.map((q) => [q.id, q]));
  for (const q of newQuests) {
    const prev = prevMap.get(q.id);
    // prev が存在しない（初回マウント or 新規追加）場合は検知しない
    if (q.status === "APPROVED" && q.approvalStamp && prev !== undefined && prev.status !== "APPROVED") {
      return { questId: q.id, stamp: q.approvalStamp, questTitle: q.template.title };
    }
  }
  return null;
}
