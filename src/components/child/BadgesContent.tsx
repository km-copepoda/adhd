"use client";

// 実績（バッジ）の本体 UI。
// 旧 `/app/child/badges` の「実績タブ」部分を抽出し、コレクションタブ
// (`/app/child/collection`) と既存ページの両方から同じ内容を表示できるようにした。
// マウント時に lastSeenBadgeUnlockedCount を更新して BottomNav バッジを既読化する。
// （ヘッダー内の「実績/ごほうび」サブタブ切替は呼び出し側の責務）

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import LoadingSpinner from "@/components/LoadingSpinner";
import { sortAndFilterBadges, isBadgeNew, type BadgeData, type BadgeFilter } from "@/lib/badgeFilter";

type BadgesResponse = {
  badges: BadgeData[];
  unlockedCount: number;
  totalCount: number;
  newlyUnlocked: string[];
};

interface BadgesContentProps {
  /** 取得元 API。親モードでは /api/parent/child-view/badges?childId=X を渡す。 */
  fetchUrl?: string;
  /** localStorage 既読フラグを更新するか。親モードでは false。 */
  trackVisit?: boolean;
  /** Supabase Realtime 購読を有効にするか。親モードでは false（2026-05-11 の方針）。 */
  enableRealtime?: boolean;
}

export default function BadgesContent({
  fetchUrl = "/api/badges",
  trackVisit = true,
  enableRealtime = true,
}: BadgesContentProps = {}) {
  const [data, setData] = useState<BadgesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<BadgeFilter>("all");

  const fetchBadges = () => {
    fetch(fetchUrl)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d: BadgesResponse) => {
        setData(d);
        if (trackVisit) {
          try {
            localStorage.setItem("lastSeenBadgeUnlockedCount", String(d.unlockedCount));
          } catch { /* ignore */ }
        }
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchBadges();

    if (!enableRealtime) {
      const onVisible = () => { if (document.visibilityState === "visible") fetchBadges(); };
      document.addEventListener("visibilitychange", onVisible);
      return () => {
        document.removeEventListener("visibilitychange", onVisible);
      };
    }

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchUrl, trackVisit, enableRealtime]);

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!data) {
    return (
      <div className="text-center text-red-400 text-sm py-12">
        エラーが起きちゃった
      </div>
    );
  }

  const badgesWithNew = data.badges.map(b => ({ ...b, isNew: isBadgeNew(b.unlockedAt) }));
  const filtered = sortAndFilterBadges(badgesWithNew, filter);
  const pct = Math.round((data.unlockedCount / data.totalCount) * 100);

  const filterOptions: { value: BadgeFilter; label: string }[] = [
    { value: "all", label: "すべて" },
    { value: "unlocked", label: "解除済み" },
    { value: "locked", label: "未解除" },
  ];

  return (
    <div>
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-center justify-between mb-2">
          <span className="text-quest-dim text-xs">
            {data.unlockedCount} / {data.totalCount}
          </span>
        </div>

        <div className="h-2 bg-quest-border rounded-full overflow-hidden mb-3">
          <div
            className="h-full bg-gradient-to-r from-yellow-500 to-quest-gold rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>

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
      </div>

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
        {!badge.unlocked && badge.progress && badge.progress.current < badge.progress.target && (
          <ProgressHint current={badge.progress.current} target={badge.progress.target} />
        )}
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

function ProgressHint({ current, target }: { current: number; target: number }) {
  const safeCurrent = Math.max(0, Math.min(current, target));
  const pct = Math.round((safeCurrent / target) * 100);
  const remaining = target - safeCurrent;
  return (
    <div className="w-full mt-1">
      <div className="h-1 bg-quest-border/50 rounded-full overflow-hidden">
        <div
          className="h-full bg-quest-gold/60 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[9px] text-quest-dim mt-0.5 block">
        あと {remaining} で解錠
      </span>
    </div>
  );
}
