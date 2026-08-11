"use client";

import { CATEGORY_LABEL, DAY_LABELS } from "@/lib/categories";
import { isTaskStreakActive } from "@/lib/date";
import { xpRangeLabel } from "@/lib/xp";
import type { Category } from "@/types";

type RegularTask = {
  id: string;
  title: string;
  emoji: string;
  category: Category;
  repeatDays: number[];
  isTemporary: boolean;
  photoBonus: boolean;
  carryOver: boolean;
  assignedChildId: string | null;
  taskStreaks: { childId: string; currentStreak: number; bestStreak: number; lastAchievedDate: string | null }[];
  completedToday: boolean;
  lastSkippedDate: string | null;
  /** server 側で active 経過日数（停止期間を除外）を計算済。停止中は増加しない。 */
  lastSkippedActiveDaysAgo: number | null;
  carryOverMissedCount: number | null;
  targetDate: string | null;
  requestedDate: string | null;
  isActive: boolean;
  pausedAt: string | null;
  createdBy: string;
};

type ChildOption = {
  id: string;
  reportDeadlineTime: string | null;
};

type Props = {
  task: RegularTask;
  childId: string;
  children: ChildOption[];
  todayDow: number;
  onEdit: (task: RegularTask) => void;
  onDelete: (id: string) => void;
  onTogglePause: (id: string, paused: boolean) => void;
};

function formatSkipBadge(activeDaysAgo: number | null): string | null {
  if (activeDaysAgo === null) return null;
  // server 側で「active 経過日数」（停止期間を除外した JST 日数）を渡してもらう。
  // client 内で `Date.now()` から再計算すると、停止中もバッジが日々増えてしまう（Codex P1-4）。
  if (activeDaysAgo <= 0) return "今日スキップ";
  if (activeDaysAgo === 1) return "昨日スキップ";
  return `${activeDaysAgo}日前スキップ`;
}

function formatPendingCarryBadge(missedCount: number | null): string | null {
  if (missedCount === null || missedCount <= 0) return null;
  return `${missedCount}回未完了`;
}

export default function RegularTaskCard({ task, childId, children, todayDow, onEdit, onDelete, onTogglePause }: Props) {
  const cat = CATEGORY_LABEL[task.category];
  const streakEntry = (task.taskStreaks ?? []).find((s) => s.childId === childId);
  const streak = isTaskStreakActive(task.repeatDays, streakEntry?.lastAchievedDate ?? null)
    ? (streakEntry?.currentStreak ?? 0)
    : 0;
  const isOffDay = !task.repeatDays.includes(todayDow);
  const isPaused = task.pausedAt !== null;
  const assignedChild = children.find((c) => c.id === task.assignedChildId);
  const carryLabel = formatPendingCarryBadge(task.carryOverMissedCount);
  const hasBadges = isPaused || task.completedToday || streak >= 1 || task.lastSkippedDate || carryLabel;
  const dimmed = task.completedToday || isPaused;
  return (
    <div
      className={`bg-quest-card border rounded-xl p-4 flex items-center gap-4 ${
        dimmed || isOffDay
          ? "border-quest-border/30"
          : "border-quest-border"
      }`}
    >
      <div className={`text-2xl ${dimmed ? "opacity-40" : isOffDay ? "opacity-35" : ""}`}>{task.emoji}</div>
      <div className="flex-1 min-w-0">
        {hasBadges && (
          <div className="flex flex-wrap items-center gap-1 mb-1">
            {isPaused && (
              <span className="text-[9px] text-quest-dim bg-quest-border/20 border border-quest-border/60 rounded px-1">
                ⏸ 停止中
              </span>
            )}
            {task.completedToday && (
              <span className="text-[9px] text-green-400 bg-green-400/15 border border-green-400/50 rounded px-1">
                ✓ 完了
              </span>
            )}
            {!task.completedToday && streak >= 1 && (
              <span className="text-[9px] text-orange-400 border border-orange-400/30 rounded px-1">
                🔥{streak}日
              </span>
            )}
            {task.lastSkippedDate && (
              <span
                title={`直近のスキップ: ${new Date(task.lastSkippedDate).toLocaleDateString("ja-JP")}`}
                className="text-[9px] text-orange-300 bg-orange-400/10 border border-orange-400/40 rounded px-1"
              >
                ⏭ {formatSkipBadge(task.lastSkippedActiveDaysAgo)}
              </span>
            )}
            {carryLabel && (
              <span
                title={`未完了が続いている回数: ${task.carryOverMissedCount}回`}
                className="text-[9px] text-red-300 bg-red-400/10 border border-red-400/40 rounded px-1"
              >
                🔁 {carryLabel}
              </span>
            )}
          </div>
        )}
        <p className={`text-sm font-medium break-all ${dimmed ? "opacity-40" : isOffDay ? "opacity-35" : ""}`}>{task.title}</p>
        <div className={`flex items-center gap-2 mt-1 text-[10px] text-quest-dim ${dimmed ? "opacity-40" : isOffDay ? "opacity-35" : ""}`}>
          <span>{cat.emoji} {cat.name}</span>
          <span>{xpRangeLabel(!!assignedChild?.reportDeadlineTime, task.photoBonus)}</span>
          {task.photoBonus && (
            <span title="写真添付あり" className="text-quest-gold/70">📷</span>
          )}
          {task.carryOver && (
            <span title="未完了を翌日に持ち越す" className="text-blue-400/70">🔁</span>
          )}
        </div>
        <div className={`flex gap-0.5 mt-1 ${dimmed ? "opacity-40" : isOffDay ? "opacity-35" : ""}`}>
          {DAY_LABELS.map((label, i) => (
            <span
              key={i}
              className={`text-[9px] w-4 h-4 flex items-center justify-center rounded ${
                task.repeatDays.includes(i)
                  ? "bg-quest-gold/20 text-quest-gold"
                  : "text-quest-dim/30"
              }`}
            >
              {label}
            </span>
          ))}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1">
        {!task.completedToday && !isPaused && isOffDay && (
          <span className="text-[9px] text-quest-dim border border-quest-border rounded px-1">
            対象外
          </span>
        )}
        <div className="flex gap-1">
          <button
            onClick={() => onTogglePause(task.id, !isPaused)}
            title={isPaused ? "子供画面での表示を再開" : "子供画面から一時的に非表示（日程は保持）"}
            className={`text-xs border rounded-lg px-2 py-1 ${
              isPaused
                ? "text-green-400 hover:text-green-300 border-green-400/30"
                : "text-quest-dim hover:text-quest-text border-quest-border"
            }`}
          >
            {isPaused ? "▶ 再開" : "⏸ 停止"}
          </button>
          <button
            onClick={() => onEdit(task)}
            className="text-xs text-blue-400 hover:text-blue-300 border border-blue-400/30 rounded-lg px-2 py-1"
          >
            編集
         </button>
         <button
           onClick={() => onDelete(task.id)}
           className="text-xs text-red-400 hover:text-red-300 border border-red-400/30 rounded-lg px-2 py-1"
         >
           削除
         </button>
        </div>
      </div>
    </div>
  );
}
