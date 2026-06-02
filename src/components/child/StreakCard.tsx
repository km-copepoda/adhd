"use client";

import { STREAK_MILESTONES } from "@/lib/streakMilestones";
import type { StreakData } from "@/hooks/useMonsterStatus";

type Props = {
  streak: StreakData;
};

export default function StreakCard({ streak }: Props) {
  return (
    <div className="bg-quest-card border border-quest-border rounded-xl p-4 mb-4 relative overflow-hidden">
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-orange-500" />
      <div className="pl-2">
        {/* 称号 */}
        {streak.currentTitle && (
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-lg">{streak.currentTitle.emoji}</span>
            <span className="text-xs text-quest-gold tracking-wider">{streak.currentTitle.title}</span>
          </div>
        )}
        {/* ストリーク数値 */}
        <div className="flex items-baseline gap-1 mb-3">
          <span className="text-2xl font-bold text-orange-400">{streak.currentStreak}</span>
          <span className="text-xs text-quest-dim">日連続</span>
        </div>
        {/* 統計 */}
        <div className="flex gap-4 text-xs">
          <div>
            <span className="text-quest-dim">今月</span>
            <span className="ml-1 text-quest-text font-medium">{streak.monthlyDays}日</span>
          </div>
          <div>
            <span className="text-quest-dim">最高</span>
            <span className="ml-1 text-quest-text font-medium">{streak.bestStreak}日</span>
          </div>
        </div>
        {/* 次のマイルストーン */}
        {(() => {
          const next = STREAK_MILESTONES.find((m) => m.days > streak.currentStreak);
          if (!next) return null;
          return (
            <div className="mt-3 flex items-center gap-2 text-xs text-quest-dim">
              <span>{next.emoji}</span>
              <span>あと{next.days - streak.currentStreak}日で「{next.title}」</span>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
