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

const REMAINING_STATUSES = new Set(["PENDING", "REJECTED"]);
/**
 * 未消化（アクションが必要な）クエスト数を返す。
 * PENDING（未報告）とREJECTED（差し戻し）を含む。
 */
export function computeRemainingCount(quests: { status: string }[]): number {
  return quests.filter((q) => REMAINING_STATUSES.has(q.status)).length;
}

const SKIPPED_STATUSES = new Set(["SKIP_REPORTED", "SKIPPED"]);
/**
 * スキップ扱いのクエスト数を返す。
 * SKIP_REPORTED（親承認待ち）と SKIPPED（親承認済み）を含む。
 * ALL_COMPLETE 宝箱の boost 判定 (スキップが混じったら 1.5倍宝箱を出さない) に使う。
 */
export function computeSkippedCount(quests: { status: string }[]): number {
  return quests.filter((q) => SKIPPED_STATUSES.has(q.status)).length;
}

/**
 * 未完了（PENDING/REJECTED）を上に、完了（REPORTED/APPROVED/SKIP_REPORTED/SKIPPED）を下に並べ替える。
 * 同じグループ内では元の順序を保つ（安定ソート）。
 */
export function sortQuestsByCompletion<T extends { status: string }>(quests: T[]): T[] {
  return [...quests].sort((a, b) => {
    const aDone = COMPLETED_STATUSES.has(a.status) ? 1 : 0;
    const bDone = COMPLETED_STATUSES.has(b.status) ? 1 : 0;
    return aDone - bDone;
  });
}

/**
 * 「今日やる宣言」用の並び替え。
 *
 * 1. eligibleForDeclaration=true（= 放置中の未完了）— 放置タスクが目に入る
 * 2. その他の未完了（PENDING/REJECTED）
 * 3. 完了済み（REPORTED/APPROVED/SKIP_REPORTED/SKIPPED）
 *
 * 各グループ内は元の順序を保つ（安定ソート）。
 */
export function sortQuestsForDeclaration<T extends { status: string; eligibleForDeclaration: boolean }>(quests: T[]): T[] {
  return [...quests].sort((a, b) => rank(a) - rank(b));
}

function rank(q: { status: string; eligibleForDeclaration: boolean }): number {
  if (COMPLETED_STATUSES.has(q.status)) return 2;
  if (q.eligibleForDeclaration) return 0;
  return 1;
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
