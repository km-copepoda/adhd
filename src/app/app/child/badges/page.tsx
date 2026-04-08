"use client";

import { useEffect, useState } from "react";
import { ALL_BADGES } from "@/lib/badges";

type BadgeData = {
  id: string;
  name: string;
  emoji: string;
  description: string;
  unlocked: boolean;
  unlockedAt: string | null;
  isNew: boolean;
};

type BadgesResponse = {
  badges: BadgeData[];
  unlockedCount: number;
  totalCount: number;
  newlyUnlocked: string[];
};

export default function BadgesPage() {
  const [data, setData] = useState<BadgesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unlocked" | "locked">("all");
  const [newIds, setNewIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/badges")
      .then(r => r.json())
      .then((d: BadgesResponse) => {
        setData(d);
        if (d.newlyUnlocked.length > 0) {
          setNewIds(new Set(d.newlyUnlocked));
        }
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-quest-bg flex items-center justify-center">
        <div className="text-quest-dim text-sm animate-pulse">読み込み中...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-quest-bg flex items-center justify-center">
        <div className="text-red-400 text-sm">エラーが発生しました</div>
      </div>
    );
  }

  const filtered = data.badges.filter(b => {
    if (filter === "unlocked") return b.unlocked;
    if (filter === "locked") return !b.unlocked;
    return true;
  });

  const pct = Math.round((data.unlockedCount / data.totalCount) * 100);

  return (
    <div className="min-h-screen bg-quest-bg pb-24">
      {/* ヘッダー */}
      <div className="sticky top-0 z-10 bg-quest-bg/95 backdrop-blur border-b border-quest-border px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-quest-gold font-bold text-lg tracking-wider">🏅 実績</h1>
          <span className="text-quest-dim text-xs">
            {data.unlockedCount} / {data.totalCount}
          </span>
        </div>

        {/* 進捗バー */}
        <div className="h-2 bg-quest-border rounded-full overflow-hidden mb-3">
          <div
            className="h-full bg-gradient-to-r from-yellow-500 to-quest-gold rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* 新着バッジ通知 */}
        {newIds.size > 0 && (
          <div className="bg-quest-gold/10 border border-quest-gold/30 rounded-lg px-3 py-2 mb-2">
            <p className="text-quest-gold text-xs font-bold">
              🎉 {newIds.size}個の新しい実績を解除しました！
            </p>
          </div>
        )}

        {/* フィルター */}
        <div className="flex gap-2">
          {(["all", "unlocked", "locked"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                filter === f
                  ? "bg-quest-gold text-quest-bg border-quest-gold font-bold"
                  : "border-quest-border text-quest-dim hover:text-quest-text"
              }`}
            >
              {f === "all" ? "すべて" : f === "unlocked" ? "解除済み" : "未解除"}
            </button>
          ))}
        </div>
      </div>

      {/* バッジ一覧 */}
      <div className="p-4 grid grid-cols-2 gap-3">
        {filtered.map(badge => (
          <BadgeCard key={badge.id} badge={badge} isNew={newIds.has(badge.id)} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center text-quest-dim text-sm py-12">
          {filter === "unlocked" ? "まだ解除した実績がありません" : "すべて解除済みです！"}
        </div>
      )}
    </div>
  );
}

function BadgeCard({ badge, isNew }: { badge: BadgeData; isNew: boolean }) {
  return (
    <div
      className={`relative rounded-xl border p-3 transition-all ${
        badge.unlocked
          ? isNew
            ? "bg-quest-gold/10 border-quest-gold shadow-lg shadow-quest-gold/20"
            : "bg-quest-card border-quest-border"
          : "bg-quest-card/50 border-quest-border/50 opacity-50"
      }`}
    >
      {isNew && (
        <span className="absolute -top-1.5 -right-1.5 bg-quest-gold text-quest-bg text-[9px] font-bold px-1.5 py-0.5 rounded-full">
          NEW
        </span>
      )}

      <div className="flex flex-col items-center text-center gap-1.5">
        <span className={`text-3xl ${badge.unlocked ? "" : "grayscale opacity-40"}`}>
          {badge.unlocked ? badge.emoji : "🔒"}
        </span>
        <span
          className={`text-xs font-bold leading-tight ${
            badge.unlocked ? "text-quest-text" : "text-quest-dim"
          }`}
        >
          {badge.name}
        </span>
        <span className="text-[10px] text-quest-dim leading-tight">
          {badge.description}
        </span>
        {badge.unlocked && badge.unlockedAt && (
          <span className="text-[9px] text-quest-gold/60 mt-0.5">
            {new Date(badge.unlockedAt).toLocaleDateString("ja-JP", {
              month: "short",
              day: "numeric",
            })}
          </span>
        )}
      </div>
    </div>
  );
}
