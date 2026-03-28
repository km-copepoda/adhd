"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  MONSTER_TABLE,
  MONSTER_TABLE_LIGHT,
  CATEGORY_LABEL,
  EGG_STAGE,
  EGG_STAGE_LIGHT,
  getEvolutionChildren,
} from "@/lib/constants";
import type { Category } from "@/types";
import LoadingSpinner from "@/components/LoadingSpinner";

type ZukanData = {
  side: string | null;
  collectedPaths: string;
};

function pathEmojis(path: string): string {
  return path
    .split("_")
    .map((s) => CATEGORY_LABEL[s as Category]?.emoji ?? "❓")
    .join("›");
}

export default function ZukanPage() {
  const [data, setData] = useState<ZukanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedS1, setExpandedS1] = useState<string | null>(null);
  const [expandedS2, setExpandedS2] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/monster")
      .then((r) => r.json())
      .then((d: ZukanData) =>
        setData({ side: d.side ?? null, collectedPaths: d.collectedPaths ?? "[]" })
      )
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data) return <LoadingSpinner />;

  const collected = new Set<string>(JSON.parse(data.collectedPaths) as string[]);
  const monsterTable = data.side === "LIGHT" ? MONSTER_TABLE_LIGHT : MONSTER_TABLE;
  const eggData = data.side === "LIGHT" ? EGG_STAGE_LIGHT : EGG_STAGE;
  const total = collected.size;
  const max = Object.keys(MONSTER_TABLE).length;

  const handleS1Click = (key: string) => {
    if (expandedS1 === key) {
      setExpandedS1(null);
      setExpandedS2(null);
    } else {
      setExpandedS1(key);
      setExpandedS2(null);
    }
  };

  const handleS2Click = (key: string) => {
    setExpandedS2(expandedS2 === key ? null : key);
  };

  const renderCard = (path: string) => {
    const isCollected = collected.has(path);
    const monster = monsterTable[path];
    const emojis = pathEmojis(path);

    return (
      <div
        className={`bg-quest-card border rounded-xl p-2 flex flex-col items-center gap-1 ${
          isCollected ? "border-quest-border" : "border-quest-border/30 opacity-50"
        }`}
      >
        <div className="text-[9px] text-quest-dim tracking-tight">{emojis}</div>
        <div className="w-16 h-16 flex items-center justify-center">
          {isCollected ? (
            <Image
              src={monster.image}
              alt={monster.name}
              width={64}
              height={64}
              className="w-full h-full object-contain"
            />
          ) : (
            <span className="text-3xl text-quest-dim/30">？</span>
          )}
        </div>
        <p
          className={`text-[10px] text-center leading-tight ${
            isCollected ? "text-quest-text" : "text-quest-dim/30"
          }`}
        >
          {isCollected ? monster.name : "？？？"}
        </p>
      </div>
    );
  };

  const stage1Keys = getEvolutionChildren("");

  return (
    <div className="px-4 pt-6 pb-8">
      <h1 className="font-serif text-quest-gold text-xl tracking-widest mb-1 text-center">
        📖 モンスター図鑑
      </h1>
      <p className="text-quest-dim text-xs text-center mb-6">
        {total} / {max} 体
      </p>

      {/* ── 卵（ルートノード） ── */}
      <div className="flex flex-col items-center">
        <div className="bg-quest-card border border-quest-border rounded-xl p-3 flex flex-col items-center gap-1 w-28">
          <Image
            src={eggData.image}
            alt="たまご"
            width={72}
            height={72}
            className="w-18 h-18 object-contain"
          />
          <p className="text-xs text-quest-text">🥚 たまご</p>
        </div>

        {/* 卵→Stage1 コネクタ */}
        <div className="w-px h-5 bg-quest-border/40" />
        <div className="w-full flex justify-center gap-px mb-1">
          <div className="flex-1 border-t border-quest-border/30" />
          <div className="flex-1 border-t border-quest-border/30" />
        </div>

        {/* ── Stage 1（3体、横並び） ── */}
        <div className="grid grid-cols-3 gap-2 w-full">
          {stage1Keys.map((key) => {
            const isOpen = expandedS1 === key;
            return (
              <button
                key={key}
                onClick={() => handleS1Click(key)}
                className={`rounded-xl transition-all ${
                  isOpen ? "ring-2 ring-quest-gold ring-offset-1 ring-offset-quest-bg" : ""
                }`}
              >
                {renderCard(key)}
              </button>
            );
          })}
        </div>

        {/* ── Stage 2（選択中のS1の子） ── */}
        {expandedS1 && (
          <div className="w-full mt-1">
            {/* コネクタ線 */}
            <div className="flex justify-center">
              <div className="w-px h-4 bg-quest-gold/40" />
            </div>
            <div className="border-l-2 border-quest-gold/30 pl-3 ml-1">
              <p className="text-quest-dim text-[10px] tracking-widest mb-2 mt-1">
                ▸ Stage 2 — {CATEGORY_LABEL[expandedS1 as Category]?.name ?? expandedS1} 系
              </p>
              <div className="grid grid-cols-3 gap-2">
                {getEvolutionChildren(expandedS1).map((key) => {
                  const isOpen = expandedS2 === key;
                  return (
                    <button
                      key={key}
                      onClick={() => handleS2Click(key)}
                      className={`rounded-xl transition-all ${
                        isOpen ? "ring-2 ring-quest-gold ring-offset-1 ring-offset-quest-bg" : ""
                      }`}
                    >
                      {renderCard(key)}
                    </button>
                  );
                })}
              </div>

              {/* ── Stage 3（選択中のS2の子） ── */}
              {expandedS2 && (
                <div className="mt-1 ml-2">
                  <div className="flex">
                    <div className="w-px h-4 bg-quest-gold/40 ml-2" />
                  </div>
                  <div className="border-l-2 border-quest-gold/20 pl-3">
                    <p className="text-quest-dim text-[10px] tracking-widest mb-2 mt-1">
                      ▸ Stage 3 — 最終形態
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {getEvolutionChildren(expandedS2).map((key) => renderCard(key))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <p className="text-quest-dim/50 text-[10px] text-center mt-8">
        タップで進化ツリーを展開
      </p>
    </div>
  );
}
