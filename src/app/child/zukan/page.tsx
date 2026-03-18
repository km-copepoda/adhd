"use client";

import { useEffect, useState } from "react";
import { MONSTER_STAGES } from "@/lib/constants";
import type { Side } from "@/types";
import LoadingSpinner from "@/components/LoadingSpinner";

type ZukanData = {
  side: Side;
  evolutionStage: number;
};

export default function ZukanPage() {
  const [data, setData] = useState<ZukanData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/monster")
      .then((r) => r.json())
      .then((d: ZukanData) => setData({ side: d.side, evolutionStage: d.evolutionStage }))
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data) {
    return (
      <LoadingSpinner />
    );
  }

  const stages = MONSTER_STAGES[data.side];

  return (
    <div className="px-4 pt-6 pb-6">
      <h1 className="font-serif text-quest-gold text-xl tracking-widest mb-6 text-center">
        📖 モンスター図鑑
      </h1>
      <div className="flex flex-col gap-4">
        {stages.map((stage, i) => {
          const isUnlocked = i <= data.evolutionStage;
          const isCurrent = i === data.evolutionStage;

          return (
            <div
              key={i}
              className={`bg-quest-card border rounded-xl p-4 flex items-center gap-4 ${
                isUnlocked ? "border-quest-border" : "border-quest-border/40 opacity-50"
              }`}
            >
              <div className="text-5xl w-14 text-center">
                {isUnlocked ? stage.emoji : "？"}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`font-serif text-lg ${isUnlocked ? "text-quest-text" : "text-quest-dim"}`}>
                    {isUnlocked ? stage.name : "？？？"}
                  </span>
                  {isCurrent && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-quest-gold/20 text-quest-gold border border-quest-gold/30 tracking-wider">
                      現在
                    </span>
                  )}
                </div>
                <div className="text-xs text-quest-dim">
                  {isUnlocked
                    ? i === stages.length - 1
                      ? "最終形態"
                      : `次の進化まで ${stage.ptToEvolve} pt`
                    : "まだ未解放"}
                </div>
              </div>
              <div className="text-quest-dim/50 text-xs">
                {isUnlocked ? `Stage ${i}` : "🔒"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
