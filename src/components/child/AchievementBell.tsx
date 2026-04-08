"use client";

import { useState, useEffect } from "react";
import { STREAK_MILESTONES, getUnreadAchievements } from "@/lib/constants";

const SEEN_KEY = "seenAchievementTitles";

function getSeenTitles(): string[] {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

function markAllSeen(currentStreak: number) {
  const achieved = STREAK_MILESTONES.filter((m) => m.days <= currentStreak).map((m) => m.title);
  localStorage.setItem(SEEN_KEY, JSON.stringify(achieved));
}

/** BottomNav に埋め込むベルボタン＋実績パネル */
export default function AchievementBell() {
  const [currentStreak, setCurrentStreak] = useState<number | null>(null);
  const [seenTitles, setSeenTitles] = useState<string[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setSeenTitles(getSeenTitles());
    fetch("/api/streak")
      .then((r) => r.json())
      .then((d) => setCurrentStreak(d.currentStreak ?? 0))
      .catch(() => {});
  }, []);

  const streak = currentStreak ?? 0;
  const achievedMilestones = STREAK_MILESTONES.filter((m) => m.days <= streak);
  const unread = getUnreadAchievements(streak, seenTitles);
  const unreadCount = unread.length;

  const handleOpen = () => {
    setOpen(true);
    if (currentStreak !== null) {
      markAllSeen(currentStreak);
      setSeenTitles(achievedMilestones.map((m) => m.title));
    }
  };

  const handleClose = () => setOpen(false);

  return (
    <>
      {/* BottomNav 内ボタン — fixed 不使用、ナビタブと同スタイル */}
      <button
        onClick={handleOpen}
        className="flex flex-col items-center gap-0.5 py-1 px-3 rounded-lg transition-colors text-quest-dim hover:text-quest-text relative"
        aria-label="実績"
      >
        <span className="relative text-xl">
          {unreadCount > 0 ? "🔔" : "🔕"}
          {unreadCount > 0 && (
            <span
              className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center"
              style={{ lineHeight: 1 }}
            >
              {unreadCount}
            </span>
          )}
        </span>
        <span className="text-[10px] tracking-wider">実績</span>
      </button>

      {/* 実績パネル（全画面オーバーレイ） */}
      {open && (
        <div
          className="fixed inset-0 z-[70] bg-black/80 flex items-end justify-center"
          onClick={handleClose}
        >
          <div
            className="bg-quest-card w-full max-w-md rounded-t-2xl p-6"
            onClick={(e) => e.stopPropagation()}
            style={{ animation: "slideUp 0.25s ease-out" }}
          >
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xl">🏆</span>
              <h3 className="text-quest-gold text-lg font-bold tracking-wider">獲得した称号</h3>
            </div>
            {achievedMilestones.length === 0 ? (
              <p className="text-quest-dim text-sm text-center py-6">
                まだ称号がありません。<br />
                <span className="text-xs">3日連続でタスクを達成すると最初の称号が解除されます！</span>
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {achievedMilestones.map((m) => {
                  const isNew = unread.some((u) => u.title === m.title);
                  return (
                    <div key={m.title} className="flex items-center gap-4 py-2 border-b border-quest-border/40 last:border-0">
                      <span className="text-3xl">{m.emoji}</span>
                      <div className="flex-1">
                        <p className="text-white font-bold text-base">{m.title}</p>
                        <p className="text-quest-dim text-xs">{m.days}日連続達成 · +{m.bonusPt}pt</p>
                      </div>
                      {isNew && (
                        <span className="bg-red-500/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                          NEW
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            <button
              onClick={handleClose}
              className="mt-5 w-full py-2 text-quest-dim text-sm border border-quest-border rounded-xl"
            >
              閉じる
            </button>
          </div>
          <style>{`
            @keyframes slideUp {
              from { transform: translateY(100%); opacity: 0; }
              to { transform: translateY(0); opacity: 1; }
            }
          `}</style>
        </div>
      )}
    </>
  );
}
