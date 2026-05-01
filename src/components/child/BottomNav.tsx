"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { shouldShowBottomNav } from "@/lib/bottom-nav";
import { shouldShowMonsterBadge, shouldShowZukanBadge, getUnreadAchievements, getNewBadgeCount, STREAK_MILESTONES } from "@/lib/streakMilestones";
import { computeRemainingCount } from "@/lib/questProgress";

const SEEN_KEY = "seenAchievementTitles";
const SEEN_BADGE_COUNT_KEY = "lastSeenBadgeUnlockedCount";

const tabs: { href: string; emoji: string; label: string; badgeKey?: "quests" | "monster" | "zukan" | "badges" }[] = [
  { href: "/app/child/quests", emoji: "⚔️", label: "クエスト" , badgeKey: "quests" },
  { href: "/app/child/monster", emoji: "🐣", label: "育成", badgeKey: "monster" },
  { href: "/app/child/zukan", emoji: "📖", label: "図鑑", badgeKey: "zukan" },
  { href: "/app/child/badges", emoji: "🏅", label: "実績", badgeKey: "badges" },
  { href: "/app/child/gathering", emoji: "🏕️", label: "ひろば" },
];

export default function BottomNav() {
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  const [questRemaining, setQuestRemaining] = useState(0);
  const [monsterBadge, setMonsterBadge] = useState(false);
  const [zukanBadge, setZukanBadge] = useState(false);
  const [badgesCount, setBadgesCount] = useState(0);
  const [rebirthReady, setRebirthReady] = useState(false);
  const statusRef = useRef<{ evolutionStage: number; collectedCount: number } | null>(null);
  const streakRef = useRef<number | null>(null);
  const unlockedBadgeCountRef = useRef<number | null>(null);

  function computeBadgesCount(streak: number, unlockedCount: number | null) {
    try {
      const seenTitles = JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]") as string[];
      const milestoneCount = getUnreadAchievements(streak, seenTitles).length;
      const badgeCount = unlockedCount !== null
        ? getNewBadgeCount(unlockedCount, localStorage.getItem(SEEN_BADGE_COUNT_KEY))
        : 0;
      setBadgesCount(milestoneCount + badgeCount);
    } catch {
      setBadgesCount(0);
    }
  }

  function fetchMonsterStatus() {
    fetch("/api/monster-status")
      .then((r) => r.json())
      .then((d) => {
        const count = (JSON.parse(d.collectedPaths ?? "[]") as string[]).length;
        statusRef.current = { evolutionStage: d.evolutionStage, collectedCount: count };
        setMonsterBadge(shouldShowMonsterBadge(d.evolutionStage, localStorage.getItem("lastSeenEvolutionStage")));
        setZukanBadge(shouldShowZukanBadge(count, localStorage.getItem("lastSeenCollectedCount")));
        setRebirthReady(!!d.rebirthPending);
      })
      .catch(() => {});
  }
  
  function fetchQuestRemaining() {
    fetch("/api/quests/today")
      .then((r) => r.json())
      .then((quests: { status: string }[]) => {
        setQuestRemaining(computeRemainingCount(quests));
      })
      .catch(() => {});
  }
  
  function fetchBadgesCount() {
    fetch("/api/badges/unseen-count")
      .then((r) => r.json())
      .then((d) => {
        const count = d.unlockedCount ?? 0;
        unlockedBadgeCountRef.current = count;
        computeBadgesCount(streakRef.current ?? 0, count);
      })
      .catch(() => {});
  }

  // 初回マウント時にモンスター状態とストリークを取得
  useEffect(() => {
    fetchMonsterStatus();
    fetchQuestRemaining();

    fetch("/api/streak")
      .then((r) => r.json())
      .then((d) => {
        const streak = d.currentStreak ?? 0;
        streakRef.current = streak;
        computeBadgesCount(streak, unlockedBadgeCountRef.current);
      })
      .catch(() => {});

    fetchBadgesCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // Realtimeでバッジをリアルタイム更新
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("child-nav-realtime")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "User" }, () => {
        fetchMonsterStatus();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "UserBadge" }, () => {
        fetchBadgesCount();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "QuestInstance" }, () => {
        fetchQuestRemaining();
      })
      .subscribe();

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        fetchMonsterStatus();
        fetchBadgesCount();
        fetchQuestRemaining();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    
    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // パス変更時にバッジを再評価
  useEffect(() => {
    pathnameRef.current = pathname;
  
    const s = statusRef.current;
    if (s) {
      setMonsterBadge(shouldShowMonsterBadge(s.evolutionStage, localStorage.getItem("lastSeenEvolutionStage")));
      setZukanBadge(shouldShowZukanBadge(s.collectedCount, localStorage.getItem("lastSeenCollectedCount")));
    }

    if (pathname?.startsWith("/app/child/badges")) {
      // 実績ページ訪問時に既読にする
      const streak = streakRef.current ?? 0;
      const achieved = STREAK_MILESTONES.filter((m) => m.days <= streak).map((m) => m.title);
      localStorage.setItem(SEEN_KEY, JSON.stringify(achieved));
      if (unlockedBadgeCountRef.current !== null) {
        localStorage.setItem(SEEN_BADGE_COUNT_KEY, String(unlockedBadgeCountRef.current));
      }
      setBadgesCount(0);
    } else if (streakRef.current !== null) {
      computeBadgesCount(streakRef.current, unlockedBadgeCountRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (!shouldShowBottomNav(pathname ?? "")) return null;

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-quest-card border-t border-quest-border z-50">
      <div className="flex justify-around items-center max-w-md mx-auto h-16">
        {tabs.map((tab) => {
          const isActive = pathname?.startsWith(tab.href);
          const hasBadge =
            (tab.badgeKey === "quests" && questRemaining > 0 && !isActive) ||
            (tab.badgeKey === "monster" && (monsterBadge || rebirthReady)) ||
            (tab.badgeKey === "zukan" && zukanBadge) ||
            (tab.badgeKey === "badges" && badgesCount > 0);
          return (
            <Link
              key={tab.label}
              href={tab.href}
              className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-lg transition-colors ${
                isActive ? "text-quest-gold" : "text-quest-dim hover:text-quest-text"
              }`}
            >
              <span className="relative text-xl">
                {tab.emoji}
                {hasBadge && (
                  tab.badgeKey === "quests" ? (
                    <span
                      className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center"
                      style={{ lineHeight: 1 }}
                    >
                      {questRemaining > 9 ? "9+" : questRemaining}
                    </span>
                  ) : tab.badgeKey === "badges" ? (
                    <span
                      className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center"
                      style={{ lineHeight: 1 }}
                    >
                      {badgesCount > 9 ? "9+" : badgesCount}
                    </span>
                  ) : (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full" />
                  )
                )}
              </span>
              <span className="text-[10px] tracking-wider">{tab.label}</span>
            </Link>
          );
        })}
        <button
          onClick={handleLogout}
          className="flex flex-col items-center gap-0.5 py-1 px-3 rounded-lg transition-colors text-quest-dim hover:text-red-400"
        >
          <span className="text-xl">🚪</span>
          <span className="text-[10px] tracking-wider">ログアウト</span>
        </button>
      </div>
    </nav>
  );
}
