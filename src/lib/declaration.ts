/**
 * 「今日やる宣言ボーナス」用の純粋ロジック。DB依存なし。
 *
 * 放置判定の基準は **「直近 N 出現の連続非 APPROVED 数」**:
 *   - 通常タスク: 出現 = 1 つの QuestInstance。週次タスクは 1 週で 1 出現なので、
 *     3 週ぶんの非 APPROVED が並ぶまで閾値に達さない。
 *     1 回スキップで翌週いきなりボタンが出る、という過剰反応を防げる。
 *   - carryOver タスク: 同じ instance が日をまたいで残るので「出現回数」は増えない。
 *     代わりに `instance.date` から today までの暦日数（inclusive）で代用。
 *
 * APPROVED が連鎖を切る唯一のステータス（spec: スキップは放置として扱う）。
 */

import type { QuestStatus } from "@/types";

export const IDLE_EXPOSURE_THRESHOLD = 3;
export const DECLARATION_BONUS_XP = 1;

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

function toJstDateFloor(d: Date): number {
  const jst = new Date(d.getTime() + JST_OFFSET_MS);
  return Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate());
}

/**
 * 直近の APPROVED より新しい非 APPROVED の連鎖長を返す。
 * carryOver の場合は連鎖最古の `instance.date` から today までの暦日数（inclusive）を使う。
 *
 * @param allInstances date 降順でソート済み（今日のインスタンスを含む）
 */
export function getMissedExposureCount(params: {
  allInstances: Array<{ date: Date; status: QuestStatus }>;
  today: Date;
  carryOver: boolean;
}): number {
  let oldestActive: { date: Date; status: QuestStatus } | null = null;
  let count = 0;
  for (const inst of params.allInstances) {
    if (inst.status === "APPROVED") break;
    oldestActive = inst;
    count++;
  }

  if (!oldestActive) return 0;

  if (params.carryOver) {
    const diffDays = Math.floor(
      (toJstDateFloor(params.today) - toJstDateFloor(oldestActive.date)) / MS_PER_DAY,
    );
    return Math.max(0, diffDays) + 1;
  }
  return count;
}

/**
 * UI 表示用: 最終 APPROVED から today までの暦日数（JST）。
 * 「X 日やってないよ」の表示に使う。一度も APPROVED されていない場合は templateCreatedAt 起点。
 */
export function getIdleCalendarDays(params: {
  today: Date;
  lastApprovedAt: Date | null;
  templateCreatedAt: Date;
}): number {
  const baseline = params.lastApprovedAt ?? params.templateCreatedAt;
  const diff = Math.floor(
    (toJstDateFloor(params.today) - toJstDateFloor(baseline)) / MS_PER_DAY,
  );
  return diff < 0 ? 0 : diff;
}

/** 「今日やる」ボタンを今日のクエストに出すべきかどうか */
export function isEligibleForDeclaration(params: {
  missedExposures: number;
  status: QuestStatus;
}): boolean {
  if (params.missedExposures < IDLE_EXPOSURE_THRESHOLD) return false;
  return params.status === "PENDING" || params.status === "REJECTED";
}
