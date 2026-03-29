export function xpRangeLabel(hasDeadline: boolean, photoBonus: boolean): string {
  const max = 1 + (hasDeadline ? 1 : 0) + (photoBonus ? 1 : 0);
  return max === 1 ? "+1pt" : `+1〜${max}pt`;
}

export function calcActualXP(deadlineBonusEarned: boolean, photoBonus: boolean, hasPhoto: boolean): number {
  return 1 + (deadlineBonusEarned ? 1 : 0) + (photoBonus && hasPhoto ? 1 : 0);
}
