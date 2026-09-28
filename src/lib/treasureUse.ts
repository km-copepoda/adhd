// #151: ごほうび使用申請の状態遷移バリデータ（純粋関数）。
//
// 許可される遷移:
//   UNUSED        -> USE_REQUESTED   (canRequestUse) 子が申請
//   USE_REQUESTED -> USED            (canApproveUse) 親が承認
//   USE_REQUESTED -> UNUSED          (canRejectUse)  親が却下
//   USED          -> UNUSED          (canRevokeUse)  親が巻き戻し
//
// 上記以外は全て false。DB操作を含まない純粋関数で、API 側はこの結果を 400 に変換する。

import type { TreasureUseStatus } from "@/generated/prisma/client";

export function canRequestUse(current: TreasureUseStatus): boolean {
  return current === "UNUSED";
}

export function canApproveUse(current: TreasureUseStatus): boolean {
  return current === "USE_REQUESTED";
}

export function canRejectUse(current: TreasureUseStatus): boolean {
  return current === "USE_REQUESTED";
}

export function canRevokeUse(current: TreasureUseStatus): boolean {
  return current === "USED";
}

/**
 * マイグレーションのバックフィル方針と同じ判定を純粋関数として表現する。
 * prisma/migrations/20260925000001_add_treasure_use_status/migration.sql 参照。
 *   fulfilled=true  AND itemId!=null -> USED
 *   itemId===null（コレクション獲得）  -> 常に UNUSED
 *   それ以外（fulfilled=false）        -> UNUSED
 */
export function deriveUseStatusFromLegacy(
  fulfilled: boolean,
  itemId: string | null,
): TreasureUseStatus {
  if (itemId === null) return "UNUSED";
  return fulfilled ? "USED" : "UNUSED";
}
