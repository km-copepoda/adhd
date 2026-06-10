export type StreakDisplayState = "none" | "active" | "atRisk" | "broken";

/**
 * 子供向けヘッダーバッジの表示状態を返す純粋関数。
 *
 * - none:    streak 0 / lastAchievedDate 未設定 → バッジ非表示
 * - active:  最終達成日 == 今日 → 通常表示（達成済み）
 * - atRisk:  最終達成日 == 昨日 → 強調表示（"今日まだ！" 警告）
 * - broken:  最終達成日 < 昨日 → DB上 streak > 0 でも実質途切れ
 *
 * 日付は "YYYY-MM-DD" または ISO 文字列で受け取り、先頭10文字で比較する。
 */
export function getStreakDisplayState(
  currentStreak: number,
  lastAchievedDate: string | null,
  todayStr: string,
): StreakDisplayState {
  if (currentStreak <= 0) return "none";
  if (!lastAchievedDate) return "none";

  const last = lastAchievedDate.slice(0, 10);
  const today = todayStr.slice(0, 10);

  if (last === today) return "active";

  const todayMs = Date.parse(today + "T00:00:00Z");
  const yesterday = new Date(todayMs - 86400000).toISOString().slice(0, 10);

  if (last === yesterday) return "atRisk";
  return "broken";
}
