"use client";

import { useCallback, useEffect, useState } from "react";
import LoadingSpinner from "@/components/LoadingSpinner";
import { formatTreasureOpenedAt } from "@/lib/treasureHistory";

type Rarity = "COMMON" | "UNCOMMON" | "RARE";

interface OpenedLog {
  id: string;
  openedAt: string;
  boosted: boolean;
  item: { id: string; title: string; rarity: Rarity } | null;
}

interface StatusResponse {
  locked: number;
  unlocked: number;
  opened: OpenedLog[];
}

const RARITY_LABEL: Record<Rarity, string> = {
  COMMON: "よく出る",
  UNCOMMON: "ときどき",
  RARE: "たまに",
};

const RARITY_BG: Record<Rarity, string> = {
  COMMON: "bg-blue-100 text-blue-700 border-blue-300",
  UNCOMMON: "bg-purple-100 text-purple-700 border-purple-300",
  RARE: "bg-amber-100 text-amber-700 border-amber-300",
};

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
  const misses = data.opened.length - hits.length;

  return (
    <div className="p-4">
      <div className="text-xs text-quest-dim mb-3">
        この1週間で <span className="font-bold text-quest-text">{data.opened.length}</span> 個ひらいたよ
        （あたり {hits.length} 個・からっぽ {misses} 個）
      </div>
      <ul className="space-y-2">
        {data.opened.map((o) => (
          <li
            key={o.id}
            className="bg-quest-card border border-quest-border rounded-lg p-3 flex items-center gap-3"
          >
            <span className="text-2xl" aria-hidden>
              {o.item ? "🎁" : "📦"}
            </span>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm truncate">
                {o.item ? o.item.title : "からっぽ…でもうれしい！"}
              </div>
              <div className="text-[11px] text-quest-dim">
                {formatTreasureOpenedAt(o.openedAt)}
                {o.boosted && <span className="ml-2 text-quest-gold">★ ボーナス宝箱</span>}
              </div>
            </div>
            {o.item && (
              <span className={`text-[11px] px-2 py-0.5 rounded border ${RARITY_BG[o.item.rarity]}`}>
                {RARITY_LABEL[o.item.rarity]}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
