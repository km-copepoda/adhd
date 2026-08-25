import { jstDateOf } from "@/lib/date";

/**
 * 宝箱（TreasureLog）の集計・照合に使う「基準日」を解決する純粋関数。
 *
 * Issue #108: 生成時（report/skip）と承認時（approve.ts）でそれぞれ独立に
 * 「今日」を再計算していたため、carryOver=true のクエストで報告日と承認日が
 * 別の暦日をまたぐと不一致になり、宝箱が永久に LOCKED のまま残るバグがあった。
 * 呼び出し側は「基準となる時刻 (at)」を明示的に渡し、生成側・承認側で同じ
 * 基準日を共有する。
 *
 * @param questDate クエストの日付（@db.Date、JST日付をUTC0時として保存）
 * @param carryOver テンプレートの carryOver フラグ
 * @param at 基準時刻（report/skip 時は報告時刻、approve 時は reportedAt を渡す）
 */
export function resolveTreasureDate(questDate: Date, carryOver: boolean, at: Date): Date {
  if (carryOver && questDate.getTime() < jstDateOf(at).getTime()) {
    return jstDateOf(at);
  }
  return questDate;
}
