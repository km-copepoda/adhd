/// クライアント側でタスク追加ボタンを押す前に上限到達を判定する (preempt) ための純粋関数。
/// サーバ側 `countActiveTasksForChild` (src/lib/subscriptionService.ts) と同じ「有効タスク」の
/// 定義をクライアント側で再現する。仕様: Issue #148 v2差分 4番。
///
/// `GET /api/tasks` の親レスポンスは既に `isActive: true` で絞られているため、
/// ここでの判定対象は `pausedAt` / `isTemporary`+`targetDate` のみ (`isActive` は含めない)。

export interface PlanLimitTaskLike {
  assignedChildId: string | null;
  pausedAt: string | null;
  isTemporary: boolean;
  targetDate: string | null;
}

/// タスクが対象の子の「上限カウント対象」かどうかを判定する。
/// - 対象の子 (assignedChildId) のタスクであること
/// - 停止中 (pausedAt !== null) でないこと
/// - 期限切れの一時タスク (幽霊タスク: isTemporary かつ targetDate < today) でないこと
export function isTaskCountedForLimit(
  task: PlanLimitTaskLike,
  childId: string,
  todayStr: string,
): boolean {
  if (task.assignedChildId !== childId) return false;
  if (task.pausedAt !== null) return false;
  if (task.isTemporary && task.targetDate !== null && task.targetDate.slice(0, 10) < todayStr) {
    return false;
  }
  return true;
}

/// 対象の子について、上限カウント対象のタスク件数を返す。
export function countActiveTasksForChildClient<T extends PlanLimitTaskLike>(
  tasks: T[],
  childId: string,
  todayStr: string,
): number {
  return tasks.filter((t) => isTaskCountedForLimit(t, childId, todayStr)).length;
}
