"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { MONSTER_TABLE, EGG_STAGE, EVOLUTION_THRESHOLDS } from "@/lib/constants";
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

  return (
    <div className="px-4 pt-6 pb-6">
      <h1 className="font-serif text-quest-gold text-xl tracking-widest mb-6 text-center">
        📖 モンスター図鑑
      </h1>
      <div className="flex flex-col gap-4">
        {stages.map(({ stage, data: monster }) => {
          const isUnlocked = stage <= data.evolutionStage;
          const isCurrent = stage === data.evolutionStage;

          return (
            <div
              key={stage}
              className={`bg-quest-card border rounded-xl p-4 flex items-center gap-4 ${
                isUnlocked ? "border-quest-border" : "border-quest-border/40 opacity-50"
              }`}
            >
              <div className="w-14 h-14 flex items-center justify-center text-center flex-shrink-0">
                {isUnlocked
                  ? monster.image
                    ? <Image src={monster.image} alt={monster.name} width={56} height={56} className="w-full h-full object-contain" />
                    : <span className="text-5xl">{monster.emoji}</span>
                  : <span className="text-3xl text-quest-dim">？</span>}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`font-serif text-lg ${isUnlocked ? "text-quest-text" : "text-quest-dim"}`}>
                    {isUnlocked ? monster.name : "？？？"}
                  </span>
                  {isCurrent && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-quest-gold/20 text-quest-gold border border-quest-gold/30 tracking-wider">
                      現在
                    </span>
                  )}
                </div>
                <div className="text-xs text-quest-dim">
                  {isUnlocked
                    ? monster.ptToEvolve === null
                      ? "最終形態"
                      : `次の進化まで ${monster.ptToEvolve} pt`
                    : "まだ未解放（進化先は運命次第…）"}
                </div>
              </div>
              <div className="text-quest-dim/50 text-xs">
                {isUnlocked ? `Stage ${stage}` : "🔒"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
