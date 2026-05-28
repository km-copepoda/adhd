"use client";

import CutsceneOverlay from "./CutsceneOverlay";

interface Props {
  count: number;
  onClose: () => void;
}

export default function TreasureGetCutscene({ count, onClose }: Props) {
  return (
    <CutsceneOverlay
      onClose={onClose}
      imageSrc="/treasure/closed.png"
      imageAlt="閉じた宝箱"
      title="宝箱ゲット！"
      titleColor="text-quest-gold"
      subtitle={count > 1 ? `${count}個もらった！` : "あとであけてみよう"}
      description="親の承認がおりたら開けられるよ"
    />
  );
}
