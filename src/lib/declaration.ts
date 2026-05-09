/**
 * 「今日やる宣言ボーナス」用の純粋ロジック。DB依存なし。
 *
 * - APPROVED のみが放置カウンタをリセットする（spec: スキップ・未完了は放置とみなす）
 * - idleDays >= IDLE_DAYS_THRESHOLD かつ 今日まだアクションしていないクエストで宣言ボタンを出す
 * - 宣言済みのタスクをその日に APPROVED まで持っていけば +DECLARATION_BONUS_XP の上乗せ
 */

import type { QuestStatus } from "@/types";

export const IDLE_DAYS_THRESHOLD = 3;
export const DECLARATION_BONUS_XP = 1;

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** Date を JST 日付の UTC0時表現に正規化する */
function toJstDateFloor(d: Date): number {
  const jst = new Date(d.getTime() + JST_OFFSET_MS);
  return Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate());
}

/**
 * 最終 APPROVED から今日までの放置日数（JST 日付差）を返す。
 * lastApprovedAt が null の場合は templateCreatedAt を baseline として使う。
 * 未来日付が来た場合は 0 にクランプ。
 */
export function getIdleDays(params: {
  today: Date;
  lastApprovedAt: Date | null;
  templateCreatedAt: Date;
}): number {
  const todayMs = toJstDateFloor(params.today);
  const baseline = params.lastApprovedAt ?? params.templateCreatedAt;
  const baselineMs = toJstDateFloor(baseline);
  const diff = Math.floor((todayMs - baselineMs) / MS_PER_DAY);
  return diff < 0 ? 0 : diff;
}

/**
 * 今日のクエストに「今日やる」ボタンを出すべきかどうか。
 * - idleDays が閾値以上
 * - 今日まだアクション可能なステータス（PENDING / REJECTED）
 */
export function isEligibleForDeclaration(params: {
  idleDays: number;
  status: QuestStatus;
}): boolean {
  if (params.idleDays < IDLE_DAYS_THRESHOLD) return false;
  return params.status === "PENDING" || params.status === "REJECTED";
}
