"use client";

import Image from "next/image";

type Props = {
  image: string;
  monsterName: string;
  stageLabel: string;
  onClose: () => void;
  description?: string;
};

export default function MonsterImageModal({ image, monsterName, stageLabel, onClose, description }: Props) {
  return (
    <div
      data-testid="monster-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative flex flex-col items-center gap-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 閉じるボタン */}
        <button
          aria-label="閉じる"
          onClick={onClose}
          className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center text-lg leading-none"
        >
          ×
        </button>

        {/* モンスター画像 */}
        <div className="w-64 h-64 flex items-center justify-center drop-shadow-[0_0_24px_rgba(251,191,36,0.4)]">
          <Image
            src={image}
            alt={monsterName}
            width={256}
            height={256}
            className="w-full h-full object-contain"
          />
        </div>

        {/* 名前・ステージ */}
        <div className="text-center">
          <p className="text-white text-xl font-bold">{monsterName}</p>
          <p className="text-white/60 text-sm mt-1">{stageLabel}</p>
        </div>

        {description && (
          <p
            data-testid="monster-modal-description"
            className="max-w-xs text-white/80 text-sm leading-relaxed text-center"
          >
            {description}
          </p>
        )}
      </div>
    </div>
  );
}
