"use client";

import Image from "next/image";

const EGG_OPTIONS = [
  {
    type: "NORMAL",
    name: "ふつうの卵",
    img: "", // side に応じて動的に決定
    desc: "ボーナスなし",
    color: "#a78bfa",
  },
  {
    type: "STUDY",
    name: "勉強の卵",
    img: "/monsters/egg-study.webp",
    desc: "📚 学力の確率+20%",
    color: "#60a5fa",
  },
  {
    type: "STAMINA",
    name: "体力の卵",
    img: "/monsters/egg-stamina.webp",
    desc: "💪 体力の確率+20%",
    color: "#f87171",
  },
  {
    type: "LIFE",
    name: "生活力の卵",
    img: "/monsters/egg-life.webp",
    desc: "🌿 生活力の確率+20%",
    color: "#4ade80",
  },
] as const;

type Props = {
  side: string | null;
  loading: boolean;
  onSelect: (eggType: string) => void;
  onCancel: () => void;
};

export default function EggSelectionModal({ side, loading, onSelect, onCancel }: Props) {
  return (
    <div
      className="fixed inset-0 z-[60] bg-black/95 flex flex-col items-center justify-center px-4"
      style={{ animation: "fadeIn 0.3s ease-out" }}
    >
      <p className="font-serif text-purple-400 text-2xl tracking-widest mb-2">卵を選ぼう</p>
      <p className="text-quest-dim text-sm mb-8 text-center">
        次回転生まで、選んだカテゴリの<br />進化確率が<span className="text-purple-400 font-bold">+20%</span>アップ！
      </p>
      <div className="flex flex-col gap-3 w-full max-w-sm">
        {EGG_OPTIONS.map(({ type, name, img, desc, color }) => {
          const eggImg = img || (side === "LIGHT" ? "/monsters/light/egg.webp" : "/monsters/dark/egg.webp");
          return (
            <button
              key={type}
              onClick={() => onSelect(type)}
              disabled={loading}
              className="bg-quest-card border border-quest-border rounded-xl p-4 flex items-center gap-4 active:scale-95 transition-transform disabled:opacity-50"
              style={{ borderColor: loading ? undefined : `${color}40` }}
            >
              <div className="w-16 h-16 flex-shrink-0">
                <Image src={eggImg} alt={name} width={64} height={64} className="w-full h-full object-contain" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-bold text-quest-text text-base">{name}</p>
                <p className="text-sm mt-0.5" style={{ color }}>{desc}</p>
              </div>
              <div className="text-quest-dim text-xl">›</div>
            </button>
          );
        })}
      </div>
      <button
        onClick={onCancel}
        className="mt-8 text-quest-dim text-sm"
      >
        キャンセル（後でする）
      </button>
      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
      `}</style>
    </div>
  );
}
