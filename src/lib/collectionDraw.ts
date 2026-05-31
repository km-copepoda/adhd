// 宝箱コレクションアイテムの抽選（純粋関数）。
// 仕様: docs/未実装仕様書/treasure-collection-items.md セクション 3
//
// 宝箱の「ごほうび抽選」がハズレ (MISS) を出したときに追加で走らせる抽選。
// - COMMON 60% / UNCOMMON 30% / RARE 10% を排他選択 (rng 1 回目)
// - 当選レアにアイテムが無ければ次に低いレアへ降格 (treasure.ts の drawTreasure と同じ規約)
// - 当選レア内のアイテム選択は uniform (rng 2 回目)
// - 必ず何か出る (天井/MISS 概念なし)。プール空のみ null。

import type { CollectionItem, CollectionRarity } from "@/lib/collectionItems";

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
): CollectionItem | null {
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
    const idx = Math.min(candidates.length - 1, Math.floor(rng() * candidates.length));
    return candidates[idx];
  }

  // ここに来るのは pool.length > 0 だが全アイテムのレアリティが認識外という異常系のみ。
  // 念のため先頭を返す。
  return pool[0];
}
