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
 * 1. idle（idleDays >= 3 かつ未完了）— 一番上に来て放置タスクが目に入る
 * 2. その他の未完了（PENDING/REJECTED）
 * 3. 完了済み（REPORTED/APPROVED/SKIP_REPORTED/SKIPPED）
 *
 * 各グループ内は元の順序を保つ（安定ソート）。
 */
import { IDLE_DAYS_THRESHOLD } from "@/lib/declaration";

export function sortQuestsForDeclaration<T extends { status: string; idleDays: number }>(quests: T[]): T[] {
  return [...quests].sort((a, b) => {
    return rank(a) - rank(b);
  });
}

function rank(q: { status: string; idleDays: number }): number {
  const isDone = COMPLETED_STATUSES.has(q.status);
  if (isDone) return 2;
  if (q.idleDays >= IDLE_DAYS_THRESHOLD) return 0;
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
