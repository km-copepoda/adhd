const COMPLETED_STATUSES = new Set([
  "REPORTED",
  "APPROVED",
  "SKIP_REPORTED",
  "SKIPPED",
]);

/**
 * 「対処済み」クエスト数を返す。
 * 完了報告（REPORTED/APPROVED）とスキップ申請（SKIP_REPORTED/SKIPPED）を含む。
 */
export function computeCompletedCount(quests: { status: string }[]): number {
  return quests.filter((q) => COMPLETED_STATUSES.has(q.status)).length;
}

/**
 * クエスト完了報告後の成功画面に表示する進捗情報を計算する。
 *
 * NOTE: completedCount は refreshQuests() 完了後の値を受け取る。
 * +1 は不要（呼び出し元ですでに更新済み）。
 */
export function computeQuestSuccessDisplay(completedCount: number, total: number) {
  const remaining = total - completedCount;
  return {
    completed: completedCount,
    remaining,
    allDone: remaining <= 0,
  };
}
