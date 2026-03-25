"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { MONSTER_TABLE, EGG_STAGE, EVOLUTION_THRESHOLDS, CATEGORY_LABEL } from "@/lib/constants";
import type { Category } from "@/types";
import LoadingSpinner from "@/components/LoadingSpinner";

type ZukanData = {
  evolutionStage: number;
  evolutionPath: string;
};

export default function ZukanPage() {
  const [data, setData] = useState<ZukanData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/monster")
      .then((r) => r.json())
      .then((d: ZukanData) => setData({ evolutionStage: d.evolutionStage, evolutionPath: d.evolutionPath ?? "" }))
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data) {
    return <LoadingSpinner />;
  }

  // ステージごとのパス履歴を再構築
  // stage 0: egg, stage 1: "STUDY", stage 2: "STUDY_STAMINA", stage 3: "STUDY_STAMINA_LIFE"
  const pathSegments = data.evolutionPath ? data.evolutionPath.split("_") : [];
  const MAX_STAGE = EVOLUTION_THRESHOLDS.length - 1;

  const stages = Array.from({ length: MAX_STAGE + 1 }, (_, i) => {
    if (i === 0) return { stage: 0, path: null, data: EGG_STAGE as { name: string; ptToEvolve: number | null; emoji?: string; image?: string } };
    const key = pathSegments.slice(0, i).join("_");
    const monster = MONSTER_TABLE[key] ?? { image: "", name: "???" };
    return {
      stage: i,
      path: key,
      data: { ...monster, ptToEvolve: EVOLUTION_THRESHOLDS[i] } as { name: string; ptToEvolve: number | null; emoji?: string; image?: string },
    };
  });

  // パスセグメント → カテゴリ絵文字の配列
  const pathToEmojis = (segments: string[]) =>
    segments.map((s) => CATEGORY_LABEL[s as Category]?.emoji ?? "❓");

  return (
    <div className="px-4 pt-6 pb-6">
      <h1 className="font-serif text-quest-gold text-xl tracking-widest mb-6 text-center">
        📖 モンスター図鑑
      </h1>
      <div className="flex flex-col gap-4">
        {stages.map(({ stage, path, data: monster }) => {
          const isUnlocked = stage <= data.evolutionStage;
          const isCurrent = stage === data.evolutionStage;
          const segments = path ? path.split("_") : [];
          const emojis = pathToEmojis(segments);

          return (
            <div
              key={stage}
              className={`bg-quest-card border rounded-xl p-4 flex items-center gap-4 ${
                isUnlocked ? "border-quest-border" : "border-quest-border/40 opacity-50"
              }`}
            >
              {/* モンスター画像 */}
              <div className="w-16 h-16 flex items-center justify-center flex-shrink-0">
                {isUnlocked
                  ? monster.image
                    ? <Image src={monster.image} alt={monster.name} width={64} height={64} className="w-full h-full object-contain" />
                    : <span className="text-5xl">{monster.emoji}</span>
                  : <span className="text-3xl text-quest-dim">？</span>}
              </div>

              {/* 情報 */}
              <div className="flex-1 min-w-0">
                {/* 系統パス */}
                {stage > 0 && (
                  <div className="flex items-center gap-0.5 mb-1">
                    {isUnlocked
                      ? emojis.map((emoji, i) => (
                          <span key={i} className="flex items-center gap-0.5">
                            {i > 0 && <span className="text-quest-dim/50 text-[10px]">→</span>}
                            <span className="text-base">{emoji}</span>
                          </span>
                        ))
                      : Array.from({ length: stage }).map((_, i) => (
                          <span key={i} className="flex items-center gap-0.5">
                            {i > 0 && <span className="text-quest-dim/50 text-[10px]">→</span>}
                            <span className="text-base text-quest-dim/40">❓</span>
                          </span>
                        ))}
                  </div>
                )}

                {/* 名前 */}
                <div className="flex items-center gap-2">
                  <span className={`font-serif text-base ${isUnlocked ? "text-quest-text" : "text-quest-dim"}`}>
                    {isUnlocked ? monster.name : "？？？"}
                  </span>
                  {isCurrent && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-quest-gold/20 text-quest-gold border border-quest-gold/30 tracking-wider shrink-0">
                      現在
                    </span>
                  )}
                </div>

                {/* 進化情報 */}
                <div className="text-[11px] text-quest-dim mt-0.5">
                  {isUnlocked
                    ? monster.ptToEvolve === null
                      ? "最終形態"
                      : `次の進化まで ${monster.ptToEvolve} pt`
                    : "進化先は運命次第…"}
                </div>
              </div>

              <div className="text-quest-dim/50 text-[11px] shrink-0">
                {isUnlocked ? `Stage ${stage}` : "🔒"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
