// 宝箱生成の可否判定（純粋関数、DB依存なし）。Issue #267。
//
// 集計対象クエストが 0 件 (totalCount=0) の日に、何も達成していないのに
// STREAK / PROXY 宝箱が作られるバグを防ぐため、判定を 1 か所に集約する。
// treasureService.ts と親代理ルート (report-approve / skip-approve) が同じ関数を使い、
// 条件の二重定義を避ける。

interface EligibilityInput {
  /** 「対処済み」クエスト数 (REPORTED + APPROVED + SKIP_REPORTED + SKIPPED) */
  reportedCount: number;
  /** 集計対象のクエスト総数 */
  totalCount: number;
}

/**
 * STREAK / PROXY 宝箱を作る条件を満たしているか。
 *  - totalCount <= 0 → false（何も無い日は作らない）
 *  - 必要数 = max(1, min(minTasks, totalCount))。少タスク日は全完了で救済し、
 *    下限 1 により「何も達成していない」場合は常に false
 */
export function meetsTreasureRequirement(
  input: EligibilityInput & { minTasks: number },
): boolean {
  if (input.totalCount <= 0) return false;
  const required = Math.max(1, Math.min(input.minTasks, input.totalCount));
  return input.reportedCount >= required;
}

/** 全完了か（ALL_COMPLETE 宝箱の条件）。0/0 は全完了扱いしない。 */
export function isAllComplete(input: EligibilityInput): boolean {
  return input.totalCount > 0 && input.reportedCount >= input.totalCount;
}
