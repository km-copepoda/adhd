// 宝箱（ごほうび）抽選の純粋関数ロジック
// 設計: docs/reword-system-design.md セクション 5〜8
//
// 振る舞い:
//  - 各アイテムに対しレア度確率で独立に抽選 (boosted で 2倍)
//  - 当たりが複数ある場合は一番レアなものを優先
//  - プールが空なら null (天井カウンタも進めない)
//  - pityCount >= PITY_THRESHOLD のときに自然ハズレなら、プールから1個強制ピック (天井発動)
//  - 当たり/天井発動時は pity を 0 にリセット、ハズレは +1

export type TreasureRarity = "COMMON" | "UNCOMMON" | "RARE";

export const RARITY_BASE_PROBABILITY: Record<TreasureRarity, number> = {
  COMMON: 1 / 7,
  UNCOMMON: 1 / 14,
  RARE: 1 / 28,
};

export const RARITY_BOOSTED_MULTIPLIER = 2;

export const PITY_THRESHOLD = 5;

export const RARITY_ORDER: Record<TreasureRarity, number> = {
  COMMON: 1,
  UNCOMMON: 2,
  RARE: 3,
};

export interface TreasurePoolItem {
  id: string;
  title: string;
  rarity: TreasureRarity;
}

export interface DrawTreasureOptions {
  boosted?: boolean;
  pityCount?: number;
  rng?: () => number;
}

export interface DrawTreasureResult {
  itemId: string | null;
  rarity: TreasureRarity | null;
  nextPityCount: number;
  pityTriggered: boolean;
}

export function drawTreasure(
  pool: TreasurePoolItem[],
  options: DrawTreasureOptions = {},
): DrawTreasureResult {
  const { boosted = false, pityCount = 0, rng = Math.random } = options;

  if (pool.length === 0) {
    return { itemId: null, rarity: null, nextPityCount: pityCount, pityTriggered: false };
  }

  const multiplier = boosted ? RARITY_BOOSTED_MULTIPLIER : 1;

  const hits: TreasurePoolItem[] = [];
  for (const item of pool) {
    const prob = RARITY_BASE_PROBABILITY[item.rarity] * multiplier;
    const r = rng();
    if (r < prob) hits.push(item);
  }

  if (hits.length > 0) {
    const best = hits.reduce((a, b) => (RARITY_ORDER[b.rarity] > RARITY_ORDER[a.rarity] ? b : a));
    return { itemId: best.id, rarity: best.rarity, nextPityCount: 0, pityTriggered: false };
  }

  if (pityCount >= PITY_THRESHOLD) {
    const idx = Math.min(pool.length - 1, Math.floor(rng() * pool.length));
    const picked = pool[idx];
    return { itemId: picked.id, rarity: picked.rarity, nextPityCount: 0, pityTriggered: true };
  }

  return { itemId: null, rarity: null, nextPityCount: pityCount + 1, pityTriggered: false };
}
