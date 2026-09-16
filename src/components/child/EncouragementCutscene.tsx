"use client";

import CutsceneOverlay from "./CutsceneOverlay";

interface Props {
  subtitle?: string;
  description: string;
  onClose: () => void;
}

export default function EncouragementCutscene({ subtitle, description, onClose }: Props) {
  return (
    <CutsceneOverlay
      onClose={onClose}
      emoji="📣"
      title="エールが届いた！"
      subtitle={subtitle}
      description={description}
    />
  );
}
