"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import LoadingSpinner from "@/components/LoadingSpinner";
import { sortAndFilterBadges, isBadgeNew, type BadgeData, type BadgeFilter } from "@/lib/badgeFilter";
import TreasureHistoryList from "@/components/child/TreasureHistoryList";

type BadgesResponse = {
  badges: BadgeData[];
  unlockedCount: number;
  totalCount: number;
  newlyUnlocked: string[];
};

type TopTab = "badges" | "treasures";

export default function BadgesPage() {
  const [data, setData] = useState<BadgesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<BadgeFilter>("all");
  const [topTab, setTopTab] = useState<TopTab>("badges");

  const fetchBadges = () => {
    fetch("/api/badges")
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d: BadgesResponse) => {
        setData(d);
        // 訪問時点の解除数を記録してBottomNavバッジをクリア
        try {
          localStorage.setItem("lastSeenBadgeUnlockedCount", String(d.unlockedCount));
        } catch { /* ignore */ }
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchBadges();

    const supabase = createClient();
    const channel = supabase
      .channel("badge-changes")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "UserBadge" }, fetchBadges)
      .subscribe();

    const onVisible = () => { if (document.visibilityState === "visible") fetchBadges(); };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-quest-bg flex items-center justify-center">
        <div className="text-red-400 text-sm">エラーが発生しました</div>
      </div>
    );
  }

  // 当日 JST に解除されたバッジを isNew=true にして先頭へソート
  const badgesWithNew = data.badges.map(b => ({ ...b, isNew: isBadgeNew(b.unlockedAt) }));
  const filtered = sortAndFilterBadges(badgesWithNew, filter);

  const pct = Math.round((data.unlockedCount / data.totalCount) * 100);

  const filterOptions: { value: BadgeFilter; label: string }[] = [
    { value: "all", label: "すべて" },
    { value: "unlocked", label: "解除済み" },
    { value: "locked", label: "未解除" },
  ];

  return (
    <div className="min-h-screen bg-quest-bg pb-24">
      {/* ヘッダー */}
      <div className="sticky top-0 z-10 bg-quest-bg/95 backdrop-blur border-b border-quest-border px-4 py-3">
        {/* トップタブ: 実績 / ごほうび */}
        <div className="flex gap-1 mb-3">
          <button
            type="button"
            onClick={() => setTopTab("badges")}
            className={`flex-1 text-sm py-1.5 rounded-md font-bold tracking-wider transition-colors ${
              topTab === "badges"
                ? "bg-quest-gold/20 text-quest-gold border border-quest-gold/30"
                : "text-quest-dim hover:text-quest-text"
            }`}
          >
            🏅 実績
          </button>
          <button
            type="button"
            onClick={() => setTopTab("treasures")}
            className={`flex-1 text-sm py-1.5 rounded-md font-bold tracking-wider transition-colors ${
              topTab === "treasures"
                ? "bg-quest-gold/20 text-quest-gold border border-quest-gold/30"
                : "text-quest-dim hover:text-quest-text"
            }`}
          >
            🎁 ごほうび
          </button>
        </div>

        {topTab === "badges" && (
          <>
            <div className="flex items-center justify-between mb-2">
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

            {/* フィルター */}
            <div className="flex gap-2 flex-wrap">
              {filterOptions.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setFilter(value)}
                  className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                    filter === value
                      ? "bg-quest-gold text-quest-bg border-quest-gold font-bold"
                      : "border-quest-border text-quest-dim hover:text-quest-text"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {topTab === "badges" ? (
        <>
          {/* バッジ一覧 */}
          <div className="p-4 grid grid-cols-2 gap-3">
            {filtered.map(badge => (
              <BadgeCard key={badge.id} badge={badge} />
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="text-center text-quest-dim text-sm py-12">
              {filter === "unlocked" ? "まだ解除した実績がありません" : "すべて解除済みです！"}
            </div>
          )}
        </>
      ) : (
        <TreasureHistoryList />
      )}
    </div>
  );
}

function BadgeCard({ badge }: { badge: BadgeData }) {
  return (
    <div
      className={`relative rounded-xl border p-3 transition-all ${
        badge.unlocked
          ? badge.isNew
            ? "bg-quest-gold/15 border-quest-gold shadow-lg shadow-quest-gold/30"
            : "bg-quest-card border-quest-border"
          : "bg-quest-card/50 border-quest-border/50 opacity-50"
      }`}
    >
      {badge.isNew && (
        <span className="absolute -top-2 -right-2 bg-quest-gold text-quest-bg text-[11px] font-bold px-2 py-0.5 rounded-full shadow-md">
          NEW
        </span>
      )}

      <div className="flex flex-col items-center text-center gap-1.5">
        <span className={`text-3xl ${badge.unlocked ? "" : "grayscale opacity-40"}`}>
          {badge.unlocked ? badge.emoji : "🔒"}
        </span>
        <span
          className={`text-xs font-bold leading-tight ${
            badge.isNew ? "text-quest-gold" : badge.unlocked ? "text-quest-text" : "text-quest-dim"
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
