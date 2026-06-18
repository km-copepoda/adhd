// QuestInstance の rejectionReason のうち、システム由来（cleanupStaleCarryOverInstances）の
// 内部識別子（DUPLICATE_PENDING_CLEANUP / STALE_CARRYOVER_CLEANUP）をユーザー画面に
// 露出させないためのフィルタ。親が手動入力した差し戻し理由はそのまま表示する。
//
// 由来コードは src/lib/quests.ts:cleanupStaleCarryOverInstances を参照。

const SYSTEM_REJECTION_REASONS = new Set<string>([
  "DUPLICATE_PENDING_CLEANUP",
  "STALE_CARRYOVER_CLEANUP",
]);

export function isSystemRejectionReason(reason: string | null | undefined): boolean {
  if (!reason) return false;
  return SYSTEM_REJECTION_REASONS.has(reason);
}

/**
 * UI 表示用に差し戻し理由を返す。system 由来 / null / 空文字は null（非表示）。
 */
export function displayRejectionReason(reason: string | null | undefined): string | null {
  if (!reason) return null;
  if (isSystemRejectionReason(reason)) return null;
  return reason;
}
