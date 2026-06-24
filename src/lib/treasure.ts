// 宝箱（ごほうび）抽選の純粋関数ロジック
//
// 振る舞い:
//  - 「排他的単発抽選」: rng を 1 回だけ消費し、その値で RARE / UNCOMMON / COMMON / MISS を排他選択
//      u in [0,                 1/45)             → RARE
//      u in [1/45,              1/45+1/20)        → UNCOMMON
//      u in [1/45+1/20,         1/45+1/20+1/10)   → COMMON
//      u in [31/180,            1.0)              → MISS
//    boosted=true なら各レア度の幅を 1.5 倍（合計 hit 率 31/180 → 31/120）
//  - 当選レア度のアイテムがプールに無ければ次に低いレア度に降格、いずれも無ければハズレ
//  - プールが空なら null
//  - **pity (天井)**: PITY_THRESHOLD 回連続でハズレた次の引きは、自然 MISS でも強制 HIT に
//    書き換える（プール内で低レア度→高レア度の順にピック）。プール空時は発動不可。
//
//  決定: 2026-05-30 「排他的単発抽選」
//        2026-06-02 pity 撤廃（コレクションアイテム導入で外れ枠が実質救済済みになったため）
//        2026-06-24 pity 復活（確率 1/10 でも 2 週間出ない不運パターンで子供のモチベが下がる救済）
//
// rng 消費順:
//  1. rarity 判定（1 回）
//  2. (HIT or pity 発動 時) 対象 tier の pool 内アイテム選択

export type TreasureRarity = "COMMON" | "UNCOMMON" | "RARE";

export const RARITY_BASE_PROBABILITY: Record<TreasureRarity, number> = {
  COMMON: 1 / 10,
  UNCOMMON: 1 / 20,
  RARE: 1 / 45,
};

export const RARITY_BOOSTED_MULTIPLIER = 1.5;

export const RARITY_ORDER: Record<TreasureRarity, number> = {
  COMMON: 1,
  UNCOMMON: 2,
  RARE: 3,
};

/**
 * 天井 (pity) 閾値。PITY_THRESHOLD 回連続で MISS が続いた次の引きで強制 HIT に書き換える。
 * 「10回に1回は必ず当たる」保証。
 */
export const PITY_THRESHOLD = 10;

// 排他抽選の判定順は「高レア度→低レア度」。u の小さい側に低確率の RARE を割り当てる。
const RARITIES_HIGH_TO_LOW: TreasureRarity[] = ["RARE", "UNCOMMON", "COMMON"];
// pity 発動時のピック順は「低レア度→高レア度」。COMMON があれば COMMON を優先する。
const RARITIES_LOW_TO_HIGH: TreasureRarity[] = ["COMMON", "UNCOMMON", "RARE"];

export interface TreasurePoolItem {
  id: string;
  title: string;
  rarity: TreasureRarity;
}

export interface DrawTreasureOptions {
  boosted?: boolean;
  /** 現在の連続 MISS 回数（0 始まり）。省略時は 0 として扱う。 */
  pityCount?: number;
  rng?: () => number;
}

export interface DrawTreasureResult {
  itemId: string | null;
  rarity: TreasureRarity | null;
  /** pity 発動により MISS を強制 HIT に書き換えたか */
  pityTriggered: boolean;
  /** 次回引き継ぐべき連続 MISS 回数 (HIT または pity 発動時は 0) */
  nextPityCount: number;
}

function pickRandomFrom<T>(items: T[], rng: () => number): T {
  const idx = Math.min(items.length - 1, Math.floor(rng() * items.length));
  return items[idx];
}

function pickFromTier(
  pool: TreasurePoolItem[],
  tier: TreasureRarity,
  rng: () => number,
): TreasurePoolItem | null {
  const items = pool.filter((p) => p.rarity === tier);
  if (items.length === 0) return null;
  return pickRandomFrom(items, rng);
}

export function drawTreasure(
  pool: TreasurePoolItem[],
  options: DrawTreasureOptions = {},
): DrawTreasureResult {
  const { boosted = false, pityCount = 0, rng = Math.random } = options;

  if (pool.length === 0) {
    // プール空: pity も発動できない。nextPityCount は加算しておく
    // (親が後でプールを追加したときに即発動できるよう、カウントは保持)
    return {
      itemId: null,
      rarity: null,
      pityTriggered: false,
      nextPityCount: pityCount + 1,
    };
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
    // 自然 HIT: 当選レア度から下に降格しつつプール内アイテムを探す（昇格は禁止）
    for (const t of RARITIES_HIGH_TO_LOW) {
      if (RARITY_ORDER[t] > RARITY_ORDER[hitTier]) continue;
      const picked = pickFromTier(pool, t, rng);
      if (picked) {
        return {
          itemId: picked.id,
          rarity: picked.rarity,
          pityTriggered: false,
          nextPityCount: 0,
        };
      }
    }
    // 当選 tier 以下にプールが無い → ハズレ扱い (HIT 領域だったが現実に出せない)
    // この場合も「親ごほうびを獲得できなかった」のでカウントは加算
    return {
      itemId: null,
      rarity: null,
      pityTriggered: false,
      nextPityCount: pityCount + 1,
    };
  }

  // 自然 MISS: 天井チェック
  if (pityCount + 1 >= PITY_THRESHOLD) {
    // pity 発動: 低レア度→高レア度の順にピック (COMMON 優先)
    for (const t of RARITIES_LOW_TO_HIGH) {
      const picked = pickFromTier(pool, t, rng);
      if (picked) {
        return {
          itemId: picked.id,
          rarity: picked.rarity,
          pityTriggered: true,
          nextPityCount: 0,
        };
      }
    }
    // ここに来るのは pool.length > 0 と矛盾するので実質到達不可だが、念のため
  }

  // ハズレ (後段でコレクションアイテム枠に回る)
  return {
    itemId: null,
    rarity: null,
    pityTriggered: false,
    nextPityCount: pityCount + 1,
  };
}
