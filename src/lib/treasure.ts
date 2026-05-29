// 宝箱（ごほうび）抽選の純粋関数ロジック
// 設計: docs/reword-system-design.md セクション 5〜8
//
// 振る舞い:
//  - 各レア度ごとに1回独立に抽選 (boosted で 1.5倍)。プールに何個あっても確率は変わらない
//  - 当たりが複数なら一番レアな当たりを採用し、そのレア度のプール内アイテムからランダムに1個選ぶ
//  - 当たりレア度のアイテムがプールに無ければ次に低いレア度の当たりに降格、いずれも無ければハズレ
//  - プールが空なら null (天井カウンタも進めない)
//  - pityCount >= PITY_THRESHOLD のときに自然ハズレなら、プールから1個強制ピック (天井発動)
//  - 当たり/天井発動時は pity を 0 にリセット、ハズレは +1
//
// rng 消費順:
//  1. COMMON 抽選, 2. UNCOMMON 抽選, 3. RARE 抽選
//  4. (HIT 時) 当たりレア度プール内のアイテム選択
//  4. (天井発動時) プール全体からアイテム選択

export type TreasureRarity = "COMMON" | "UNCOMMON" | "RARE";

export const RARITY_BASE_PROBABILITY: Record<TreasureRarity, number> = {
  COMMON: 1 / 7,
  UNCOMMON: 1 / 14,
  RARE: 1 / 28,
};

export const RARITY_BOOSTED_MULTIPLIER = 1.5;

export const PITY_THRESHOLD = 5;

export const RARITY_ORDER: Record<TreasureRarity, number> = {
  COMMON: 1,
  UNCOMMON: 2,
  RARE: 3,
};

const RARITIES_LOW_TO_HIGH: TreasureRarity[] = ["COMMON", "UNCOMMON", "RARE"];

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

function pickRandomFrom<T>(items: T[], rng: () => number): T {
  const idx = Math.min(items.length - 1, Math.floor(rng() * items.length));
  return items[idx];
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

  // レア度ごとに 1 回ずつ独立抽選（プールサイズ非依存）
  const hitTiers: TreasureRarity[] = [];
  for (const r of RARITIES_LOW_TO_HIGH) {
    const prob = RARITY_BASE_PROBABILITY[r] * multiplier;
    if (rng() < prob) hitTiers.push(r);
  }

  // 高レア度から順に「プールにそのレア度のアイテムが存在するか」を確認
  const tiersHighToLow = hitTiers
    .slice()
    .sort((a, b) => RARITY_ORDER[b] - RARITY_ORDER[a]);
  for (const tier of tiersHighToLow) {
    const tierItems = pool.filter((p) => p.rarity === tier);
    if (tierItems.length === 0) continue;
    const picked = pickRandomFrom(tierItems, rng);
    return { itemId: picked.id, rarity: picked.rarity, nextPityCount: 0, pityTriggered: false };
  }

  // ハズレ → 天井チェック
  if (pityCount >= PITY_THRESHOLD) {
    const picked = pickRandomFrom(pool, rng);
    return { itemId: picked.id, rarity: picked.rarity, nextPityCount: 0, pityTriggered: true };
  }

  return { itemId: null, rarity: null, nextPityCount: pityCount + 1, pityTriggered: false };
}
