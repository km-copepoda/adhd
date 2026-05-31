"use client";

// コレクションアイテム (宝箱で親ごほうび不当選時に獲得) の図鑑タブ。
// 仕様: docs/未実装仕様書/treasure-collection-items.md
//
// - 現在シーズン (春/夏/秋/冬) をデフォルト表示し、シーズンタブで切替可能
// - 各シーズン 20種 (=80種 / 4)。所持済みは画像+名前を表示、未所持はシルエット
// - 同じアイテムを複数回引いている場合は count を表示

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import LoadingSpinner from "@/components/LoadingSpinner";
import {
  CATEGORY_LABEL,
  SEASON_LABEL,
  type CollectionCategory,
  type CollectionRarity,
  type CollectionSeason,
} from "@/lib/collectionItems";

interface ApiItem {
  id: string;
  season: CollectionSeason;
  category: CollectionCategory;
  rarity: CollectionRarity;
  name: string;
  description: string;
  image: string;
  owned: boolean;
  count: number;
  firstAcquiredAt: string | null;
  lastAcquiredAt: string | null;
}

interface ApiResponse {
  currentSeason: CollectionSeason;
  items: ApiItem[];
}

interface Props {
  fetchUrl?: string;
}

const SEASON_ORDER: CollectionSeason[] = ["spring", "summer", "fall", "winter"];

const SEASON_EMOJI: Record<CollectionSeason, string> = {
  spring: "🌸",
  summer: "🌻",
  fall: "🍁",
  winter: "❄️",
};

const RARITY_COLOR_HEX: Record<CollectionRarity, string> = {
  COMMON: "rgba(96,165,250,0.4)",
  UNCOMMON: "rgba(168,85,247,0.5)",
  RARE: "rgba(251,191,36,0.7)",
};

const RARITY_LABEL: Record<CollectionRarity, string> = {
  COMMON: "★",
  UNCOMMON: "★★",
  RARE: "★★★",
};

const CATEGORY_ORDER: CollectionCategory[] = [
  "creature",
  "food",
  "jewel",
  "tool",
  "nature",
];

export default function ItemsContent({ fetchUrl = "/api/collection-items" }: Props = {}) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [season, setSeason] = useState<CollectionSeason | null>(null);
  const [selected, setSelected] = useState<ApiItem | null>(null);

  useEffect(() => {
    fetch(fetchUrl)
      .then((r) => r.json())
      .then((d: ApiResponse) => {
        setData(d);
        setSeason((s) => s ?? d.currentSeason);
      })
      .finally(() => setLoading(false));
  }, [fetchUrl]);

  const grouped = useMemo(() => {
    if (!data || !season) return null;
    const items = data.items.filter((i) => i.season === season);
    const byCat: Record<CollectionCategory, ApiItem[]> = {
      creature: [],
      food: [],
      jewel: [],
      tool: [],
      nature: [],
    };
    for (const it of items) byCat[it.category].push(it);
    return byCat;
  }, [data, season]);

  if (loading || !data || !season) return <LoadingSpinner />;

  const seasonItems = data.items.filter((i) => i.season === season);
  const ownedInSeason = seasonItems.filter((i) => i.owned).length;
  const totalOwned = data.items.filter((i) => i.owned).length;

  return (
    <div className="px-4 pt-6 pb-24">
      <h1 className="font-serif text-quest-gold text-xl tracking-widest mb-1 text-center">
        🎁 コレクションアイテム
      </h1>
      <p className="text-quest-dim text-xs text-center mb-4">
        ぜんぶで <span className="text-quest-text font-bold">{totalOwned}</span> /{" "}
        {data.items.length} こ
      </p>

      {/* シーズンタブ */}
      <div className="flex gap-1 mb-4 justify-center">
        {SEASON_ORDER.map((s) => {
          const isActive = s === season;
          const isCurrent = s === data.currentSeason;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setSeason(s)}
              className={`flex-1 max-w-24 text-xs py-1.5 rounded-md font-bold tracking-wider transition-colors border ${
                isActive
                  ? "bg-quest-gold/20 text-quest-gold border-quest-gold/30"
                  : "text-quest-dim border-transparent hover:text-quest-text"
              }`}
            >
              {SEASON_EMOJI[s]} {SEASON_LABEL[s]}
              {isCurrent && (
                <span className="ml-1 text-[9px] text-quest-mint">今</span>
              )}
            </button>
          );
        })}
      </div>

      <p className="text-center text-quest-dim text-[11px] mb-4">
        {SEASON_LABEL[season]}: {ownedInSeason} / {seasonItems.length} 種
      </p>

      {/* カテゴリーごとに表示 */}
      {grouped &&
        CATEGORY_ORDER.map((cat) => {
          const items = grouped[cat];
          if (items.length === 0) return null;
          return (
            <div key={cat} className="mb-5">
              <h2 className="text-xs font-bold text-quest-dim tracking-widest mb-2">
                {CATEGORY_LABEL[cat]}
              </h2>
              <div className="grid grid-cols-4 gap-2">
                {items.map((it) => (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => it.owned && setSelected(it)}
                    disabled={!it.owned}
                    className={`bg-quest-card border rounded-lg p-2 flex flex-col items-center gap-1 text-center transition-transform ${
                      it.owned
                        ? "border-quest-border hover:scale-105 cursor-pointer"
                        : "border-transparent opacity-60"
                    }`}
                    style={{
                      borderColor: it.owned ? RARITY_COLOR_HEX[it.rarity] : undefined,
                    }}
                  >
                    <div className="relative w-16 h-16 flex items-center justify-center">
                      <Image
                        src={it.image}
                        alt={it.owned ? it.name : "未獲得"}
                        width={64}
                        height={64}
                        className="object-contain"
                        style={{
                          filter: it.owned ? undefined : "brightness(0) opacity(0.3)",
                        }}
                      />
                      {it.owned && it.count > 1 && (
                        <span className="absolute -bottom-1 -right-1 bg-quest-gold text-quest-bg text-[9px] font-bold rounded-full px-1.5 py-0.5">
                          ×{it.count}
                        </span>
                      )}
                    </div>
                    <p
                      className="text-[10px] leading-tight truncate w-full"
                      style={{ color: it.owned ? undefined : "rgba(154,140,110,0.5)" }}
                    >
                      {it.owned ? it.name : "？？？"}
                    </p>
                    <span
                      className="text-[9px] px-1 rounded"
                      style={{
                        background: RARITY_COLOR_HEX[it.rarity],
                        opacity: it.owned ? 1 : 0.4,
                      }}
                    >
                      {RARITY_LABEL[it.rarity]}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}

      {/* 詳細モーダル */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-6"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-quest-card border border-quest-border rounded-2xl p-6 max-w-xs w-full text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-32 h-32 mx-auto mb-3 flex items-center justify-center">
              <Image
                src={selected.image}
                alt={selected.name}
                width={128}
                height={128}
                className="object-contain"
                style={{
                  filter: `drop-shadow(0 0 16px ${RARITY_COLOR_HEX[selected.rarity]})`,
                }}
              />
            </div>
            <h3 className="font-bold text-lg text-quest-text mb-1">{selected.name}</h3>
            <p className="text-[10px] text-quest-dim mb-3">
              {SEASON_LABEL[selected.season]} / {CATEGORY_LABEL[selected.category]} /{" "}
              {RARITY_LABEL[selected.rarity]}
            </p>
            <p className="text-xs text-quest-text mb-4">{selected.description}</p>
            {selected.count > 1 && (
              <p className="text-[11px] text-quest-mint mb-3">
                これまでに {selected.count} 回ゲットしたよ！
              </p>
            )}
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="text-xs text-quest-dim"
            >
              タップして閉じる
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
