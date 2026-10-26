// 宝箱コレクションアイテムの抽選（純粋関数）。
// 仕様: docs/未実装仕様書/treasure-collection-items.md セクション 3
//
// 親ごほうび抽選 (drawTreasure) が当選を返さなかったときに追加で走らせる抽選。
// - COMMON 60% / UNCOMMON 30% / RARE 10% を排他選択 (rng 1 回目)
// - 当選レアにアイテムが無ければ次に低いレアへ降格 (treasure.ts の drawTreasure と同じ規約)
// - 当選レア内のアイテム選択は重み付き (rng 2 回目)。未所持=UNOWNED_WEIGHT、所持済み=1。
//   ownedIds 省略時は全て未所持扱い (一様)。レア度の確率は変えない。
// - 必ず何か出る (天井/MISS 概念なし)。プール空のみ null。

import type { CollectionItem, CollectionRarity } from "@/lib/collectionItems";

export const UNOWNED_WEIGHT = 3;

// 高レアから順に判定: u ∈ [0, 0.10) → RARE, [0.10, 0.40) → UNCOMMON, [0.40, 1.00) → COMMON
const RARITY_BUCKETS: Array<{ rarity: CollectionRarity; cumulative: number }> = [
  { rarity: "RARE", cumulative: 0.10 },
  { rarity: "UNCOMMON", cumulative: 0.40 },
  { rarity: "COMMON", cumulative: 1.00 },
];

const FALLBACK_ORDER: Record<CollectionRarity, CollectionRarity[]> = {
  RARE: ["RARE", "UNCOMMON", "COMMON"],
  UNCOMMON: ["UNCOMMON", "COMMON"],
  COMMON: ["COMMON"],
};

export function drawCollectionItem(
  pool: CollectionItem[],
  rng: () => number = Math.random,
  ownedIds?: ReadonlySet<string>,
):CollectionItem | null {
  if (pool.length === 0) return null;

  const u = rng();
  let tier: CollectionRarity = "COMMON";
  for (const b of RARITY_BUCKETS) {
    if (u < b.cumulative) {
      tier = b.rarity;
      break;
    }
  }

  for (const t of FALLBACK_ORDER[tier]) {
    const candidates = pool.filter((i) => i.rarity === t);
    if (candidates.length === 0) continue;
    const weights = candidates.map((c) => (ownedIds?.has(c.id) ? 1 : UNOWNED_WEIGHT));
    const total = weights.reduce((a, b) => a + b, 0);
    const target = rng() * total;
    let acc = 0;
    for (let i = 0; i < candidates.length; i++) {
      acc += weights[i];
      if (target < acc) return candidates[i];
    }
    return candidates[candidates.length - 1];
  }

  // ここに来るのは pool.length > 0 だが全アイテムのレアリティが認識外という異常系のみ。
  // 念のため先頭を返す。
  return pool[0];
}
