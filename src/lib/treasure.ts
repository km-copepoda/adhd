// 宝箱（ごほうび）抽選の純粋関数ロジック
//
// 振る舞い:
//  - 「排他的単発抽選」: rng を 1 回だけ消費し、その値で RARE / UNCOMMON / COMMON / MISS を排他選択
//      u in [0,                 1/28)            → RARE
//      u in [1/28,              1/28+1/14)       → UNCOMMON
//      u in [1/28+1/14,         1/28+1/14+1/7)   → COMMON
//      u in [1/4,               1.0)             → MISS
//    boosted=true なら各レア度の幅を 1.5 倍（合計 hit 率 1/4 → 3/8）
//  - 当選レア度のアイテムがプールに無ければ次に低いレア度に降格、いずれも無ければハズレ
//  - プールが空なら null
//
//  決定: 2026-05-30 「排他的単発抽選」/ 2026-06-02 pity (天井) を撤廃
//        (ハズレ枠 = コレクションアイテム獲得が必ず付くため pity の存在意義が消えた)
//
// rng 消費順:
//  1. rarity 判定（1 回）
//  2. (HIT 時) 当選レア度（または降格先）のプール内アイテム選択

export type TreasureRarity = "COMMON" | "UNCOMMON" | "RARE";

export const RARITY_BASE_PROBABILITY: Record<TreasureRarity, number> = {
  COMMON: 1 / 7,
  UNCOMMON: 1 / 14,
  RARE: 1 / 28,
};

export const RARITY_BOOSTED_MULTIPLIER = 1.5;

export const RARITY_ORDER: Record<TreasureRarity, number> = {
  COMMON: 1,
  UNCOMMON: 2,
  RARE: 3,
};

// 排他抽選の判定順は「高レア度→低レア度」。u の小さい側に低確率の RARE を割り当てる。
const RARITIES_HIGH_TO_LOW: TreasureRarity[] = ["RARE", "UNCOMMON", "COMMON"];

export interface TreasurePoolItem {
  id: string;
  title: string;
  rarity: TreasureRarity;
}

export interface DrawTreasureOptions {
  boosted?: boolean;
  rng?: () => number;
}

export interface DrawTreasureResult {
  itemId: string | null;
  rarity: TreasureRarity | null;
}

function pickRandomFrom<T>(items: T[], rng: () => number): T {
  const idx = Math.min(items.length - 1, Math.floor(rng() * items.length));
  return items[idx];
}

export function drawTreasure(
  pool: TreasurePoolItem[],
  options: DrawTreasureOptions = {},
): DrawTreasureResult {
  const { boosted = false, rng = Math.random } = options;

  if (pool.length === 0) {
    return { itemId: null, rarity: null };
  }

  const multiplier = boosted ? RARITY_BOOSTED_MULTIPLIER : 1;

  // 排他抽選: 1回の rng で RARE / UNCOMMON / COMMON / MISS を決める
  const u = rng();
  let acc = 0;
  let hitTier: TreasureRarity | null = null;
  for (const r of RARITIES_HIGH_TO_LOW) {
    const p = RARITY_BASE_PROBABILITY[r] * multiplier;
    if (u < acc + p) {
      hitTier = r;
      break;
    }
    acc += p;
  }

  if (hitTier !== null) {
    // 当選レア度から下に降格しつつプール内アイテムを探す（昇格は禁止）
    for (const t of RARITIES_HIGH_TO_LOW) {
      if (RARITY_ORDER[t] > RARITY_ORDER[hitTier]) continue;
      const items = pool.filter((p) => p.rarity === t);
      if (items.length === 0) continue;
      const picked = pickRandomFrom(items, rng);
      return { itemId: picked.id, rarity: picked.rarity };
    }
  }

  // ハズレ (後段でコレクションアイテム枠に回る)
  return { itemId: null, rarity: null };
}
