"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getStreakDisplayState } from "@/lib/streakDisplay";
import { todayStringJST } from "@/lib/date";
import { shouldShowBottomNav } from "@/lib/bottom-nav";

type StreakResponse = {
  currentStreak: number;
  lastAchievedDate: string | null;
};

/**
 * 子供レイアウトに常駐し、画面左上に🔥+連続日数を出す Duolingo ライクのバッジ。
 * - atRisk（昨日達成・今日未達）のときは "今日まだ！" を併記し pulse して途切れを強く意識させる
 * - broken のときも数字は残す（鼓舞用）
 * - クリックで育成ページ（既存 StreakCard）に遷移して詳細を確認できる
 */
export default function StreakHeaderBadge() {
  const pathname = usePathname();
  const [streak, setStreak] = useState(0);
  const [lastDate, setLastDate] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    function fetchStreak() {
      fetch("/api/streak")
        .then((r) => r.json())
        .then((d: StreakResponse) => {
          if (cancelled) return;
          setStreak(d.currentStreak ?? 0);
          setLastDate(d.lastAchievedDate ?? null);
        })
        .catch(() => {});
    }

    fetchStreak();

    // 親承認 / 報告 / スキップ で QuestInstance が変わるたびに再フェッチ
    const supabase = createClient();
    const channel = supabase
      .channel("child-streak-badge")
      .on("postgres_changes", { event: "*", schema: "public", table: "QuestInstance" }, () => {
        fetchStreak();
      })
      .subscribe();

    const onVisible = () => {
      if (document.visibilityState === "visible") fetchStreak();
    };
    document.addEventListener("visibilitychange", onVisible);

    const onStreakChanged = () => fetchStreak();
    window.addEventListener("streak-changed", onStreakChanged);

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("streak-changed", onStreakChanged);
    };
  }, []);

  if (!shouldShowBottomNav(pathname ?? "")) return null;

  const state = getStreakDisplayState(streak, lastDate, todayStringJST());
  if (state === "none") return null;

  const styleByState: Record<typeof state, string> = {
    active:
      "bg-gradient-to-br from-orange-500 to-red-500 text-white shadow-lg shadow-orange-500/40",
    atRisk:
      "bg-gradient-to-br from-yellow-400 to-orange-500 text-white shadow-lg shadow-yellow-500/50 animate-pulse",
    broken: "bg-quest-card text-quest-dim border border-quest-border",
  };

  return (
    <Link
      href="/app/child/monster"
      aria-label={`連続${streak}日のストリーク`}
      className={`fixed top-3 left-3 z-50 flex items-center gap-1.5 rounded-full px-3 py-1.5 font-bold transition-all ${styleByState[state]}`}
    >
      <span className="text-lg leading-none">🔥</span>
      <span className="text-base tabular-nums leading-none">{streak}</span>
      {state === "atRisk" && (
        <span className="ml-1 text-[10px] font-semibold tracking-wider leading-none">
          今日まだ！
        </span>
      )}
    </Link>
  );
}
