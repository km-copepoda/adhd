"use client";

import CutsceneOverlay from "./CutsceneOverlay";

interface Props {
  currentStreak: number;
  onClose: () => void;
}

export default function CheckinSuccessCutscene({ currentStreak, onClose }: Props) {
  const subtitle =
    currentStreak >= 2
      ? `🔥 ${currentStreak}日連続！`
      : currentStreak === 1
        ? "🔥 今日から連続スタート！"
        : undefined;

  return (
    <CutsceneOverlay
      onClose={onClose}
      emoji="🌟"
      glowColor="rgba(253,224,71,0.85)"
      title="チェックイン成功！"
      titleColor="text-yellow-300"
      subtitle={subtitle}
      subtitleColor="text-orange-300"
      description="今日もアプリを開けたね。えらい！"
    />
  );
}
