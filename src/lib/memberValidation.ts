/** 子供のモンスター名の最大文字数 */
export const MAX_MONSTER_NAME_LENGTH = 20;
/** ストリーク判定に必要な 1 日あたり最小タスク数の上限 */
export const MAX_MIN_TASKS_FOR_STREAK = 20;

/** モンスター名として妥当か（文字列・空白のみでない・上限以内） */
export function isValidMonsterName(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= MAX_MONSTER_NAME_LENGTH
  );
}

/** サイド（LIGHT / DARK）として妥当か */
export function isValidSide(value: unknown): value is "LIGHT" | "DARK" {
  return value === "LIGHT" || value === "DARK";
}

/** minTasksForStreak として妥当か（1〜上限の整数） */
export function isValidMinTasksForStreak(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= MAX_MIN_TASKS_FOR_STREAK
  );
}
