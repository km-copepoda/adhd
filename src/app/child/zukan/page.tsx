"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { MONSTER_TABLE, MONSTER_TABLE_LIGHT, CATEGORY_LABEL } from "@/lib/constants";
import type { Category } from "@/types";
import LoadingSpinner from "@/components/LoadingSpinner";

type ZukanData = {
  side: string | null;
  collectedPaths: string;
};

// パスキーを「ステージ1 → ステージ2 → ステージ3」でグループ化
const STAGE1_KEYS = Object.keys(MONSTER_TABLE).filter((k) => k.split("_").length === 1);
const STAGE2_KEYS = Object.keys(MONSTER_TABLE).filter((k) => k.split("_").length === 2);
const STAGE3_KEYS = Object.keys(MONSTER_TABLE).filter((k) => k.split("_").length === 3);

const pathToEmojis = (path: string) =>
  path.split("_").map((s) => CATEGORY_LABEL[s as Category]?.emoji ?? "❓");

export default function ZukanPage() {
  const [data, setData] = useState<ZukanData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/monster")
      .then((r) => r.json())
      .then((d: ZukanData) => setData({ side: d.side ?? null, collectedPaths: d.collectedPaths ?? "[]" }))
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data) {
    return <LoadingSpinner />;
  }

  const collected = new Set<string>(JSON.parse(data.collectedPaths) as string[]);
  const total = collected.size;
  const max = Object.keys(MONSTER_TABLE).length;
  const monsterTable = data.side === "LIGHT" ? MONSTER_TABLE_LIGHT : MONSTER_TABLE;

  const renderGroup = (label: string, keys: string[]) => (
    <div key={label} className="mb-6">
      <h2 className="text-quest-dim text-xs tracking-widest mb-3 px-1">{label}</h2>
      <div className="grid grid-cols-3 gap-3">
        {keys.map((key) => {
          const monster = monsterTable[key];
          const isCollected = collected.has(key);
          const emojis = pathToEmojis(key);

          return (
            <div
              key={key}
              className={`bg-quest-card border rounded-xl p-3 flex flex-col items-center gap-1 ${
                isCollected ? "border-quest-border" : "border-quest-border/30 opacity-50"
              }`}
            >
              {/* 系統パス */}
              <div className="flex items-center gap-0.5 text-[10px]">
                {isCollected
                  ? emojis.map((emoji, i) => (
                      <span key={i} className="flex items-center">
                        {i > 0 && <span className="text-quest-dim/50 mx-0.5">→</span>}
                        <span>{emoji}</span>
                      </span>
                    ))
                  : emojis.map((_, i) => (
                      <span key={i} className="flex items-center text-quest-dim/30">
                        {i > 0 && <span className="mx-0.5">→</span>}
                        <span>❓</span>
                      </span>
                    ))}
              </div>

              {/* モンスター画像 */}
              <div className="w-28 h-28 flex items-center justify-center">
                {isCollected
                  ? <Image src={monster.image} alt={monster.name} width={112} height={112} className="w-full h-full object-contain" />
                  : <span className="text-4xl text-quest-dim/30">？</span>}
              </div>

              {/* 名前 */}
              <p className={`text-[11px] text-center ${isCollected ? "text-quest-text" : "text-quest-dim/30"}`}>
                {isCollected ? monster.name : "？？？"}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="px-4 pt-6 pb-6">
      <h1 className="font-serif text-quest-gold text-xl tracking-widest mb-2 text-center">
        📖 モンスター図鑑
      </h1>
      <p className="text-quest-dim text-xs text-center mb-6">
        {total} / {max} 体
      </p>

      {renderGroup("Stage 1", STAGE1_KEYS)}
      {renderGroup("Stage 2", STAGE2_KEYS)}
      {renderGroup("Stage 3（最終形態）", STAGE3_KEYS)}
    </div>
  );
}
