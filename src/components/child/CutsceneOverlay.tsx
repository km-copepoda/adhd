"use client";

import Image from "next/image";

type Props = {
  onClose: () => void;
  imageSrc?: string;
  imageAlt?: string;
  emoji?: string;
  glowColor?: string;
  title: string;
  titleColor?: string;
  subtitle?: string;
  subtitleColor?: string;
  description?: string;
  bonus?: { text: string; color: string };
};

export default function CutsceneOverlay({
  onClose,
  imageSrc,
  imageAlt = "",
  emoji,
  glowColor = "rgba(251,191,36,0.8)",
  title,
  titleColor = "text-quest-gold",
  subtitle,
  subtitleColor = "text-quest-gold/70",
  description,
  bonus,
}: Props) {
  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/90 px-6"
      onClick={onClose}
      style={{ animation: "fadeIn 0.3s ease-out" }}
    >
      <div style={{ animation: "evolveIn 0.5s ease-out" }}>
        <div
          className="w-80 h-80 mb-6 mx-auto flex items-center justify-center"
          style={{
            filter: `drop-shadow(0 0 40px ${glowColor})`,
            animation: "pulse 0.8s ease-in-out infinite alternate",
          }}
        >
          {imageSrc ? (
            <Image src={imageSrc} alt={imageAlt} width={320} height={320} className="w-full h-full object-contain" />
          ) : emoji ? (
            <span className="text-9xl">{emoji}</span>
          ) : (
            <span className="text-9xl">🥚</span>
          )}
        </div>
      </div>
      <p
        className={`font-serif ${titleColor} text-3xl tracking-widest mb-1`}
        style={{ animation: "evolveIn 0.6s ease-out", textShadow: `0 0 20px ${glowColor}` }}
      >
        {title}
      </p>
      {subtitle && (
        <p className={`${subtitleColor} text-lg mb-4`}>{subtitle}</p>
      )}
      {description && (
        <p
          className="text-quest-dim/80 text-xs text-center leading-relaxed mb-6 max-w-xs"
          style={{ animation: "evolveIn 0.7s ease-out" }}
        >
          {description}
        </p>
      )}
      {bonus && (
        <p
          className="text-xl font-bold mb-8"
          style={{ animation: "evolveIn 0.7s ease-out", color: bonus.color, textShadow: `0 0 12px ${bonus.color}80` }}
        >
          {bonus.text}
        </p>
      )}
      <p className="text-quest-dim text-xs">タップして閉じる</p>
      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes evolveIn { from { opacity: 0; transform: scale(0.3) } to { opacity: 1; transform: scale(1) } }
        @keyframes pulse { from { transform: scale(1) } to { transform: scale(1.1) } }
      `}</style>
    </div>
  );
}
