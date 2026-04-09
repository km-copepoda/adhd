type QuestStub = {
  id: string;
  status: string;
  approvalStamp: string | null;
  template: { title: string };
};

/**
 * 前後のクエスト一覧を比較し、新たにスタンプ付き承認されたクエストを返す。
 * 複数ある場合は最初の1件のみ返す（一度に1つの祝福を表示）。
 */
export function findNewlyStampedApproval(
  prevQuests: QuestStub[],
  newQuests: QuestStub[],
): { stamp: string; questTitle: string } | null {
  const prevMap = new Map(prevQuests.map((q) => [q.id, q]));
  for (const q of newQuests) {
    const prev = prevMap.get(q.id);
    if (q.status === "APPROVED" && q.approvalStamp && prev?.status !== "APPROVED") {
      return { stamp: q.approvalStamp, questTitle: q.template.title };
    }
  }
  return null;
}
