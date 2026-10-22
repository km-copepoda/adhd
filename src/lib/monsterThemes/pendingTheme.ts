// 転生時に予約済みテーマ（pendingMonsterSetId, Issue #85）を反映するための純粋関数。
// 子供本人転生・親代理転生の両方から使い、挙動の食い違いを防ぐ（Issue #189）。

export type RebirthThemeUpdate =
  | { monsterSetId: string; pendingMonsterSetId: null }
  | Record<string, never>;

export function buildRebirthThemeUpdate(
  pendingMonsterSetId: string | null | undefined,
): RebirthThemeUpdate {
  return pendingMonsterSetId
    ? { monsterSetId: pendingMonsterSetId, pendingMonsterSetId: null }
    : {};
}
