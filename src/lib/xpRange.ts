export function xpRangeLabel(hasDeadline: boolean, photoBonus: boolean): string {
  const max = 1 + (hasDeadline ? 1 : 0) + (photoBonus ? 1 : 0);
  return max === 1 ? "+1pt" : `+1〜${max}pt`;
}
