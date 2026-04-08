"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { shouldShowBottomNav } from "@/lib/bottom-nav";
import { shouldShowMonsterBadge, shouldShowZukanBadge } from "@/lib/constants";
import AchievementBell from "@/components/child/AchievementBell";

const tabs: { href: string; emoji: string; label: string; disabled?: boolean; badgeKey?: "monster" | "zukan" }[] = [
  { href: "/app/child/quests", emoji: "⚔️", label: "クエスト" },
  { href: "#", emoji: "🏘️", label: "集落", disabled: true },
  { href: "/app/child/monster", emoji: "🐣", label: "育成", badgeKey: "monster" },
  { href: "/app/child/zukan", emoji: "📖", label: "図鑑", badgeKey: "zukan" },
];

export default function BottomNav() {
  const pathname = usePathname();
  const [monsterBadge, setMonsterBadge] = useState(false);
  const [zukanBadge, setZukanBadge] = useState(false);
  const statusRef = useRef<{ evolutionStage: number; collectedCount: number } | null>(null);

  function refreshBadges() {
    const s = statusRef.current;
    if (!s) return;
    setMonsterBadge(shouldShowMonsterBadge(s.evolutionStage, localStorage.getItem("lastSeenEvolutionStage")));
    setZukanBadge(shouldShowZukanBadge(s.collectedCount, localStorage.getItem("lastSeenCollectedCount")));
  }

  // 初回マウント時にモンスター状態を取得
  useEffect(() => {
    fetch("/api/monster-status")
      .then((r) => r.json())
      .then((d) => {
        const count = (JSON.parse(d.collectedPaths ?? "[]") as string[]).length;
        statusRef.current = { evolutionStage: d.evolutionStage, collectedCount: count };
        refreshBadges();
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // パス変更時（育成/図鑑ページを離れた後）にバッジを再評価
  useEffect(() => {
    refreshBadges();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (!shouldShowBottomNav(pathname ?? "")) return null;

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/app/child/login";
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-quest-card border-t border-quest-border z-50">
      <div className="flex justify-around items-center max-w-md mx-auto h-16">
        {tabs.map((tab) => {
          const isActive = pathname?.startsWith(tab.href) && !tab.disabled;
          const hasBadge = (tab.badgeKey === "monster" && monsterBadge) || (tab.badgeKey === "zukan" && zukanBadge);
          return (
            <Link
              key={tab.label}
              href={tab.disabled ? "#" : tab.href}
              className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-lg transition-colors ${
                tab.disabled
                  ? "opacity-30 pointer-events-none"
                  : isActive
                    ? "text-quest-gold"
                    : "text-quest-dim hover:text-quest-text"
              }`}
            >
              <span className="relative text-xl">
                {tab.emoji}
                {hasBadge && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full" />
                )}
              </span>
              <span className="text-[10px] tracking-wider">{tab.label}</span>
            </Link>
          );
        })}
        <AchievementBell />
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
