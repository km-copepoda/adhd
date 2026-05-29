/**
 * 宝箱レア度の UI 共通定数。
 * - ラベル（子向け文言）と Tailwind クラスを 4 つの宝箱画面（子・親 双方）で使い回す。
 * - 配色は `docs/design-tone-and-manner.md` に従い **ダーク背景前提** にしている。
 *   ライトカラー（bg-*-100 等）と `text-white` は使わない。
 */

export type TreasureRarity = "COMMON" | "UNCOMMON" | "RARE";

export const RARITY_LABEL: Record<TreasureRarity, string> = {
  COMMON: "よく出る",
  UNCOMMON: "ときどき",
  RARE: "たまに",
};

/**
 * quest-card 背景の上に置く、レア度バッジ用 Tailwind クラス。
 * 透明度を使った薄い塗り + 同系色のボーダー + 明るめのテキスト という構成で、
 * ダークパレット上で識別性を保つ。
 */
export const RARITY_BADGE_CLASS: Record<TreasureRarity, string> = {
  COMMON: "bg-blue-500/10 text-blue-300 border border-blue-500/40",
  UNCOMMON: "bg-purple-500/10 text-purple-300 border border-purple-500/40",
  RARE: "bg-quest-gold/15 text-quest-gold border border-quest-gold/50",
};

/**
 * 子向けレア度表示。テキストラベル(`RARITY_LABEL`)より直感的に「すごさ」が伝わる
 * 星の数表現。RARE ほど星が多い。
 * 親の設定 UI は `RARITY_LABEL`（文言）を使う方が明示的なので置き換えない。
 */
export const RARITY_STARS: Record<TreasureRarity, string> = {
  COMMON: "🌟",
  UNCOMMON: "🌟🌟",
  RARE: "🌟🌟🌟",
};

/** 子画面の宝箱「あたり」表示で使う、星付きレア度文字列。 */
export function formatChildRarity(rarity: TreasureRarity): string {
  return `レア度：${RARITY_STARS[rarity]}`;
}
