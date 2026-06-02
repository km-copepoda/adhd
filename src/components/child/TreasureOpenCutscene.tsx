"use client";

import CutsceneOverlay from "./CutsceneOverlay";
import { formatChildRarity, type TreasureRarity } from "@/lib/treasureRarity";
import type { CollectionRarity, CollectionSeason } from "@/lib/collectionItems";
import { SEASON_LABEL } from "@/lib/collectionItems";

interface CollectionItemResult {
  id: string;
  name: string;
  rarity: CollectionRarity;
  season: CollectionSeason;
  description: string;
  image: string;
  count: number;
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

export default function TreasureOpenCutscene({ result, onClose }: Props) {
  // 親が設定したごほうび当選 → 親ごほうび演出
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
    return (
      <CutsceneOverlay
        onClose={onClose}
        imageSrc={ci.image}
        imageAlt={ci.name}
        glowColor={glow}
        title={ci.name}
        titleColor="text-quest-gold"
        subtitle={isNew ? `${seasonLabel}のコレクションをゲット！` : `${seasonLabel}のコレクション（${ci.count}個目）`}
        description={ci.description}
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
