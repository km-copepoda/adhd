/**
 * quests 画面最上部に常設する「チェックイン状況ピル」の1行文言を組み立てる純粋関数。
 *
 * トンマナは `CheckinSuccessCutscene` の出し分けと一致させる:
 *  - currentStreak >= 2  → "🔥 N日連続！"
 *  - currentStreak === 1 → "🔥 今日から連続スタート！"（"1日連続" という数値表現は使わない）
 *  - currentStreak === 0 → 連続日数バッジは出さない（"🔥 0日連続" は防御的に禁止）
 */

export type CheckinTodayStatus = "success" | "fail" | "pending";

export interface CheckinPillInput {
  enabled: boolean;
  todayStatus: CheckinTodayStatus;
  currentStreak: number;
}

export function getCheckinPillLabel(input: CheckinPillInput): string | null {
  const { enabled, todayStatus, currentStreak } = input;
  if (!enabled) return null;

  const streakPart =
    currentStreak >= 2
      ? `🔥 ${currentStreak}日連続！`
      : currentStreak === 1
        ? "🔥 今日から連続スタート！"
        : "";

  const basePart = (() => {
    switch (todayStatus) {
      case "success":
        return "今日はチェックイン済み！";
      case "fail":
        return "今日はチェックインし忘れちゃったね。明日またチャレンジ！";
      case "pending":
      default:
        return "今日のチェックインはまだだよ";
    }
  })();

  return streakPart ? `${streakPart} ${basePart}` : basePart;
}
