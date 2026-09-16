"use client";

import CutsceneOverlay from "./CutsceneOverlay";
import { formatChildRarity, type TreasureRarity } from "@/lib/treasureRarity";
import type { CollectionRarity, CollectionSeason } from "@/lib/collectionItems";
import { SEASON_LABEL } from "@/lib/collectionItems";
import { pickRuby } from "@/lib/ruby";

interface CollectionItemResult {
  id: string;
  name: string;
  nameKana: string;
  rarity: CollectionRarity;
  season: CollectionSeason;
  description: string;
  descriptionKana: string;
  image: string;
  count: number;
  /** 月限定アイテムのみ設定 (1〜12)。通常アイテムは undefined */
  month?: number;
}

interface Result {
  /** 親が設定したごほうび。当選しなかった場合 null（その代わり collectionItem が入る） */
  item: { id: string; title: string; rarity: TreasureRarity } | null;
  /** 親ごほうび不当選時に付与されたコレクションアイテム */
  collectionItem: CollectionItemResult | null;
}

interface Props {
  result: Result;
  onClose: () => void;
  /**
   * Issue #140: 自分では API を叩かないため、呼び出し元が
   * status API（/api/treasures/status 系）から取得した値を渡す。
   * 非 boolean（undefined/null/文字列/数値）は true（かな表示）にフォールバックする。
   */
  rubyEnabled?: unknown;
}

const RARITY_COLOR: Record<TreasureRarity, string> = {
  COMMON: "rgba(96,165,250,0.8)",
  UNCOMMON: "rgba(168,85,247,0.8)",
  RARE: "rgba(251,191,36,0.9)",
};

const COLLECTION_RARITY_COLOR: Record<CollectionRarity, string> = {
  COMMON: "rgba(96,165,250,0.7)",
  UNCOMMON: "rgba(168,85,247,0.8)",
  RARE: "rgba(251,191,36,0.9)",
};

const COLLECTION_RARITY_LABEL: Record<CollectionRarity, string> = {
  COMMON: "ふつう",
  UNCOMMON: "ちょっとレア",
  RARE: "とってもレア",
};

export default function TreasureOpenCutscene({ result, onClose, rubyEnabled: rubyEnabledRaw }: Props) {
  const rubyEnabled = typeof rubyEnabledRaw === "boolean" ? rubyEnabledRaw : true;
  // 親が設定したごほうび当選 → 親ごほうび演出
  // Issue #140: 親が自由入力した item.title は変換データが存在しないためかな化しない
  if (result.item) {
    const glow = RARITY_COLOR[result.item.rarity];
    return (
      <CutsceneOverlay
        onClose={onClose}
        imageSrc="/treasure/open2.png"
        imageAlt="ごほうびの宝箱"
        glowColor={glow}
        title={result.item.title}
        titleColor="text-quest-gold"
        subtitle="宝箱をひらいた！"
        description={formatChildRarity(result.item.rarity)}
        bonus={{ text: "おうちの人に「もらった！」を伝えよう", color: "text-quest-mint" }}
      />
    );
  }

  // 親ごほうび不当選 → 季節コレクションアイテム演出
  if (result.collectionItem) {
    const ci = result.collectionItem;
    const glow = COLLECTION_RARITY_COLOR[ci.rarity];
    const seasonLabel = SEASON_LABEL[ci.season];
    const isNew = ci.count === 1;
    const isMonthly = ci.month !== undefined;
    // 月限定アイテムは「◯月げんてい」を強調 (取り逃すと1年待ちの特別感を演出)
    const kindLabel = isMonthly ? `✨${ci.month}月げんてい✨` : `${seasonLabel}のコレクション`;
    // Issue #140: kana フィールドは必須型だが、旧レスポンス/呼び出し元との後方互換のため
    // 未設定時は空文字扱いにして pickRuby にフォールバックさせる
    const displayName = pickRuby(ci.name, ci.nameKana ?? "", rubyEnabled);
    const displayDescription = pickRuby(ci.description, ci.descriptionKana ?? "", rubyEnabled);
    return (
      <CutsceneOverlay
        onClose={onClose}
        imageSrc={ci.image}
        imageAlt={displayName}
        glowColor={glow}
        title={displayName}
        titleColor="text-quest-gold"
        subtitle={isNew ? `${kindLabel}をゲット！` : `${kindLabel}（${ci.count}個目）`}
        description={displayDescription}
        bonus={{
          text: `🏆 ${COLLECTION_RARITY_LABEL[ci.rarity]}`,
          color: ci.rarity === "RARE" ? "text-quest-gold" : "text-quest-mint",
        }}
      />
    );
  }

  // どちらも無いケースは API 仕様上発生しない
  return null;
}
