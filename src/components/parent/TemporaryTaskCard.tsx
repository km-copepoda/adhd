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
};

type ChildOption = {
  id: string;
  reportDeadlineTime: string | null;
};

type Props = {
  task: TemporaryTask;
  children: ChildOption[];
  onDelete: (id: string) => void;
};

export default function TemporaryTaskCard({ task, children, onDelete }: Props) {
  const cat = CATEGORY_LABEL[task.category];
  const assignedChild = children.find((c) => c.id === task.assignedChildId);
  const dateStr = task.targetDate
    ? new Date(task.targetDate).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" })
    : "今日";
  return (
    <div className="bg-quest-card border border-quest-border rounded-xl p-4 flex items-center gap-4">
      <div className="text-2xl">{task.emoji}</div>
      <div className="flex-1 min-w-0">
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
          onClick={() => onDelete(task.id)}
          className="text-xs text-red-400 hover:text-red-300 border border-red-400/30 rounded-lg px-2 py-1"
        >
          削除
        </button>
      </div>
    </div>
  );
}
