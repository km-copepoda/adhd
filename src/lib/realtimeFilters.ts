// Supabase Realtime（postgres_changes）の購読フィルタを組み立てる純粋関数。
//
// フィルタなしで購読すると、どの家庭の行が変わっても Realtime が購読者全員について RLS を評価し、
// 対象外の変更でも各画面が再取得に走る。購読を自分（または自分の家族の子供）の行に絞って、
// DB 負荷と不要な再取得を減らす。

export type ChildRealtimeTable = "User" | "UserBadge" | "QuestInstance" | "TreasureLog";
export type FamilyRealtimeTable = "QuestInstance" | "TreasureLog" | "TaskTemplate";

const CHILD_FILTER_COLUMN: Record<ChildRealtimeTable, string> = {
  User: "id",
  UserBadge: "userId",
  QuestInstance: "childId",
  TreasureLog: "childId",
};

const FAMILY_FILTER_COLUMN: Record<FamilyRealtimeTable, string> = {
  QuestInstance: "childId",
  TreasureLog: "childId",
  TaskTemplate: "assignedChildId",
};

/** 子供画面用: 自分の行だけに絞る。userId 未取得なら undefined（フィルタなし）。 */
export function childRealtimeFilter(table: ChildRealtimeTable, userId: string | null): string | undefined {
  if (!userId) return undefined;
  return `${CHILD_FILTER_COLUMN[table]}=eq.${userId}`;
}

/**
 * 親画面用: 家族の子供の行に絞る。
 * - childIds が null（取得失敗）なら undefined（フィルタなしにフォールバック）
 * - childIds が空なら null（監視対象がないので購読不要）
 */
export function familyRealtimeFilter(
  table: FamilyRealtimeTable,
  childIds: string[] | null,
): string | null | undefined {
  if (childIds === null) return undefined;
  if (childIds.length === 0) return null;
  return `${FAMILY_FILTER_COLUMN[table]}=in.(${childIds.join(",")})`;
}
