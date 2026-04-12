/**
 * クエストの XP を計算する。
 * 基本 1pt + 期限ボーナス + 写真ボーナス (最大 3pt)
 */
export function calculateQuestXP(quest: {
  deadlineBonusEarned: boolean;
  photoUrl: string | null;
  template: { photoBonus: boolean };
}): number {
  let xp = 1;
  if (quest.deadlineBonusEarned) xp++;
  if (quest.template.photoBonus && quest.photoUrl) xp++;
  return xp;
}
