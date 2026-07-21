"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import LoadingSpinner from "@/components/LoadingSpinner";
import { formatTreasureOpenedAt } from "@/lib/treasureHistory";
import {
  RARITY_BADGE_CLASS,
  formatChildRarity,
  type TreasureRarity,
} from "@/lib/treasureRarity";
import { SEASON_LABEL, type CollectionRarity } from "@/lib/collectionItems";

const COLLECTION_RARITY_STARS: Record<CollectionRarity, string> = {
  COMMON: "★",
  UNCOMMON: "★★",
  RARE: "★★★",
};

interface OpenedLog {
  id: string;
  openedAt: string;
  boosted: boolean;
  item: { id: string; title: string; rarity: TreasureRarity } | null;
  collectionItem: {
    id: string;
    name: string;
    season: "spring" | "summer" | "fall" | "winter";
    rarity: CollectionRarity;
    image: string;
    month?: number;
  } | null;
}

interface StatusResponse {
  locked: number;
  unlocked: number;
  opened: OpenedLog[];
}

export default function TreasureHistoryList() {
  const [data, setData] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/treasures/status", { cache: "no-store" });
      if (!res.ok) {
        setData(null);
        return;
      }
      const json = (await res.json()) as StatusResponse;
      setData(json);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchHistory();
  }, [fetchHistory]);

  if (loading) return <LoadingSpinner />;
  if (!data || data.opened.length === 0) {
    return (
      <div className="text-center text-quest-dim text-sm py-12 px-4">
        <p>まだ宝箱を開けていません。</p>
        <p className="text-xs mt-2">クエストを報告すると宝箱がもらえるよ！</p>
        <p className="text-[11px] mt-3 opacity-70">※ 1週間前までの宝箱を表示しています</p>
      </div>
    );
  }

  const hits = data.opened.filter((o) => o.item !== null);
  const collectionWins = data.opened.length - hits.length;

  return (
    <div className="p-4">
      <div className="text-xs text-quest-dim mb-3">
        この1週間で <span className="font-bold text-quest-text">{data.opened.length}</span> 個ひらいたよ
        （ごほうび {hits.length} 個・コレクション {collectionWins} 個）
      </div>
      <ul className="space-y-2">
        {data.opened.map((o) => (
          <li
            key={o.id}
            className="bg-quest-card border border-quest-border rounded-lg p-3 flex items-center gap-3"
          >
            <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center" aria-hidden>
              {o.item ? (
                <span className="text-2xl">🎁</span>
              ) : o.collectionItem ? (
                <Image
                  src={o.collectionItem.image}
                  alt={o.collectionItem.name}
                  width={32}
                  height={32}
                  className="w-full h-full object-contain"
                />
              ) : (
                <span className="text-2xl">🏆</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm truncate">
                {o.item ? o.item.title : o.collectionItem ? o.collectionItem.name : "コレクションアイテム"}
              </div>
              <div className="text-[11px] text-quest-dim">
                {o.collectionItem && (
                  <span className="mr-2">
                    {o.collectionItem.month !== undefined
                      ? `✨${o.collectionItem.month}月げんてい`
                      : SEASON_LABEL[o.collectionItem.season]}
                    ・{COLLECTION_RARITY_STARS[o.collectionItem.rarity]}
                  </span>
                )}
                {formatTreasureOpenedAt(o.openedAt)}
                {o.boosted && <span className="ml-2 text-quest-gold">★ ボーナス宝箱</span>}
              </div>
            </div>
            {o.item && (
              <span className={`text-[11px] px-2 py-0.5 rounded ${RARITY_BADGE_CLASS[o.item.rarity]}`}>
                {formatChildRarity(o.item.rarity)}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
