"use client";

import { CATEGORY_LABEL } from "@/lib/categories";
import { xpRangeLabel } from "@/lib/xp";
import type { Category } from "@/types";

type TemporaryTask = {
  id: string;
  title: string;
  emoji: string;
  category: Category;
  photoBonus: boolean;
  targetDate: string | null;
  assignedChildId: string | null;
  pausedAt: string | null;
};

type ChildOption = {
  id: string;
  reportDeadlineTime: string | null;
};

type Props = {
  task: TemporaryTask;
  childOptions: ChildOption[];
  onDelete: (id: string) => void;
  onTogglePause: (id: string, paused: boolean) => void;
};

export default function TemporaryTaskCard({ task, childOptions, onDelete, onTogglePause }: Props) {
  const cat = CATEGORY_LABEL[task.category];
  const assignedChild = childOptions.find((c) => c.id === task.assignedChildId);
  const isPaused = task.pausedAt !== null;
  const dateStr = task.targetDate
    ? new Date(task.targetDate).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" })
    : "今日";
  return (
    <div className={`bg-quest-card border rounded-xl p-4 flex items-center gap-4 ${isPaused ? "border-quest-border/30" : "border-quest-border"}`}>
      <div className={`text-2xl ${isPaused ? "opacity-40" : ""}`}>{task.emoji}</div>
      <div className={`flex-1 min-w-0 ${isPaused ? "opacity-40" : ""}`}>
        {isPaused && (
          <div className="flex flex-wrap items-center gap-1 mb-1">
            <span className="text-[9px] text-quest-dim bg-quest-border/20 border border-quest-border/60 rounded px-1">
              ⏸ 停止中
            </span>
          </div>
        )}
        <p className="text-sm font-medium break-all">{task.title}</p>
        <div className="flex items-center gap-2 mt-1 text-[10px] text-quest-dim">
          <span>{cat.emoji} {cat.name}</span>
          <span>{xpRangeLabel(!!assignedChild?.reportDeadlineTime, task.photoBonus)}</span>
          {task.photoBonus && (
            <span title="写真添付あり" className="text-quest-gold/70">📷</span>
          )}
          <span className="text-amber-400/70">📅 {dateStr}</span>
        </div>
      </div>
      <div className="flex gap-1">
        <button
          onClick={() => onTogglePause(task.id, !isPaused)}
          title={isPaused ? "子供画面での表示を再開" : "子供画面から一時的に非表示（targetDate は保持）"}
          className={`text-xs border rounded-lg px-2 py-1 ${
            isPaused
              ? "text-green-400 hover:text-green-300 border-green-400/30"
              : "text-quest-dim hover:text-quest-text border-quest-border"
          }`}
        >
          {isPaused ? "▶ 再開" : "⏸ 停止"}
        </button>
        <button
          onClick={() => onDelete(task.id)}
          className="text-xs text-red-400 hover:text-red-300 border border-red-400/30 rounded-lg px-2 py-1"
        >
          削除
        </button>
      </div>
    </div>
  );
}
