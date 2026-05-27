"use client";

import { useMemo } from "react";
import CutsceneOverlay from "./CutsceneOverlay";

interface Result {
  miss: boolean;
  pityTriggered: boolean;
  item: { id: string; title: string; rarity: "COMMON" | "UNCOMMON" | "RARE" } | null;
}

interface Props {
  result: Result;
  onClose: () => void;
}

// ハズレ時のポジティブ演出メッセージ（設計 8 章）
const MISS_MESSAGES = [
  "モンスターがうれしそうにしている！ ✨",
  "モンスターのきげんが良くなった！ 😊",
  "冒険の記録がふえた！ 📖",
  "モンスターが元気になった！ 💪",
  "モンスターがなついてきた！ 💕",
  "今日もよくがんばったね！ 🌟",
];

const RARITY_LABEL: Record<"COMMON" | "UNCOMMON" | "RARE", string> = {
  COMMON: "よく出る",
  UNCOMMON: "ときどき",
  RARE: "たまに",
};

const RARITY_COLOR: Record<"COMMON" | "UNCOMMON" | "RARE", string> = {
  COMMON: "rgba(96,165,250,0.8)", // blue-400
  UNCOMMON: "rgba(168,85,247,0.8)", // purple-500
  RARE: "rgba(251,191,36,0.9)", // amber-400
};

export default function TreasureOpenCutscene({ result, onClose }: Props) {
  const missMessage = useMemo(
    () => MISS_MESSAGES[Math.floor(Math.random() * MISS_MESSAGES.length)],
    [],
  );

  if (result.miss) {
    return (
      <CutsceneOverlay
        onClose={onClose}
        emoji="📦"
        title="からっぽ…"
        titleColor="text-quest-gold/80"
        subtitle="でも"
        description={missMessage}
      />
    );
  }

  if (!result.item) return null;
  const glow = RARITY_COLOR[result.item.rarity];
  return (
    <CutsceneOverlay
      onClose={onClose}
      emoji="🎁"
      glowColor={glow}
      title={result.item.title}
      titleColor="text-quest-gold"
      subtitle={result.pityTriggered ? "ようやくキタ！" : "宝箱をひらいた！"}
      description={RARITY_LABEL[result.item.rarity]}
      bonus={{ text: "おうちの人に「もらった！」を伝えよう", color: "text-quest-mint" }}
    />
  );
}
