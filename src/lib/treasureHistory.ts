/**
 * 宝箱の開封履歴に関する純粋関数。
 * - 子画面 `/app/child/badges` の「ごほうび」タブと、親画面 `/app/parent/treasures/pending` で共用する。
 * - 30日（1か月固定）より古い開封履歴は子画面に出さない方針（DB 上は残るが UI は隠す）。
 *   親画面は履歴用途なのでこの制限を掛けない（各行に visibleToChild の計算値を付与する）。
 * - #72: 子が子画面から `fulfilled` をトグルできるようになったため、保持期間を 7日 → 30日 に拡大。
 */

export const TREASURE_HISTORY_RETENTION_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** now から TREASURE_HISTORY_RETENTION_DAYS 日前の Date を返す。 */
export function getTreasureHistoryCutoff(now: Date): Date {
  return new Date(now.getTime() - TREASURE_HISTORY_RETENTION_DAYS * DAY_MS);
}

/** openedAt が直近 TREASURE_HISTORY_RETENTION_DAYS 日以内（cutoff 以上）なら true。境界は inclusive。 */
export function isWithinTreasureHistoryWindow(
  openedAt: Date | null | undefined,
  now: Date,
): boolean {
  if (!openedAt) return false;
  const cutoff = getTreasureHistoryCutoff(now);
  return openedAt.getTime() >= cutoff.getTime();
}

/**
 * 宝箱開封時刻を JST の "M/D H:mm" 形式に整形する。
 * 子画面・親画面の履歴表示で共用する。
 */
export function formatTreasureOpenedAt(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const jst = new Date(d.getTime() + JST_OFFSET_MS);
  const m = jst.getUTCMonth() + 1;
  const day = jst.getUTCDate();
  const h = jst.getUTCHours();
  const min = String(jst.getUTCMinutes()).padStart(2, "0");
  return `${m}/${day} ${h}:${min}`;
}
