export function xpRangeLabel(hasDeadline: boolean, photoBonus: boolean, declared: boolean = false): string {
  // 宣言ボーナス（+1）は宣言時点で確定するので min/max の両方に乗る
  const min = 1 + (declared ? 1 : 0);
  const max = min + (hasDeadline ? 1 : 0) + (photoBonus ? 1 : 0);
  return min === max ? `+${min}pt` : `+${min}〜${max}pt`;
}

export function calcActualXP(
  deadlineBonusEarned: boolean,
  photoBonus: boolean,
  hasPhoto: boolean,
  declared: boolean = false,
): number {
  return 1 + (deadlineBonusEarned ? 1 : 0) + (photoBonus && hasPhoto ? 1 : 0) + (declared ? 1 : 0);
}

type QuestForXp = {
  status: string;
  deadlineBonusEarned: boolean;
  photoUrl: string | null;
  declaredToday: boolean;
  template: { photoBonus: boolean };
};

/**
 * 指定ステータスのクエストの XP 合計を返す。
 * 仮ゲージ（REPORTED）と本ゲージ（APPROVED）は同一ロジックで集計するため共通化。
 */
export function sumQuestXp(quests: QuestForXp[], status: string): number {
  return quests
    .filter((q) => q.status === status)
    .reduce(
      (sum, q) =>
        sum +
        calcActualXP(q.deadlineBonusEarned, q.template.photoBonus, !!q.photoUrl, q.declaredToday),
      0,
    );
}
