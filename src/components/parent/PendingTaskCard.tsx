"use client";

import { CATEGORY_LABEL, DAY_LABELS } from "@/lib/categories";
import { xpRangeLabel } from "@/lib/xp";
import type { Category } from "@/types";

type PendingTask = {
  id: string;
  title: string;
  emoji: string;
  category: Category;
  repeatDays: number[];
  isTemporary: boolean;
  targetDate: string | null;
  requestedDate: string | null;
  photoBonus: boolean;
  carryOver: boolean;
  assignedChildId: string | null;
};

type ChildOption = {
  id: string;
  reportDeadlineTime: string | null;
};

type Props = {
  task: PendingTask;
  children: ChildOption[];
  onEdit: (task: PendingTask) => void;
  onApprove: (id: string) => void;
  onDelete: (id: string) => void;
};

export default function PendingTaskCard({ task, children, onEdit, onApprove, onDelete }: Props) {
  const cat = CATEGORY_LABEL[task.category];
  const assignedChild = children.find((c) => c.id === task.assignedChildId);
  return (
    <div className="bg-quest-card border border-purple-400/30 rounded-xl p-4 flex items-center gap-4">
      <div className="text-2xl">{task.emoji}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-1.5">
          <p className="text-sm font-medium break-all">{task.title}</p>
          <span className="text-[9px] text-purple-400/70 border border-purple-400/30 rounded px-1 shrink-0 mt-0.5">仮</span>
        </div>
        <div className="flex items-center gap-2 mt-1 text-[10px] text-quest-dim">
          <span>{cat.emoji} {cat.name}</span>
          <span>{xpRangeLabel(!!assignedChild?.reportDeadlineTime, task.photoBonus)}</span>
          {task.photoBonus && (
            <span title="写真添付あり" className="text-quest-gold/70">📷</span>
          )}
          {task.carryOver && (
            <span title="未完了を翌日に持ち越す" className="text-blue-400/70">🔁</span>
          )}
          {task.isTemporary ? (
            <span className="text-amber-400/70">一時</span>
          ) : (
            <span className="text-quest-dim/60">
              {DAY_LABELS.filter((_, i) => task.repeatDays.includes(i)).join("/")}
            </span>
          )}
          {task.requestedDate && (
            <span className="text-purple-400/60">
              申請日:{new Date(task.requestedDate).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" })}
            </span>
          )}
        </div>
      </div>
      <div className="flex gap-1">
        <button
          onClick={() => onEdit(task)}
          className="text-xs text-blue-400 hover:text-blue-300 border border-blue-400/30 rounded-lg px-2 py-1"
        >
          編集
        </button>
        <button
          onClick={() => onApprove(task.id)}
          className="text-xs text-purple-400 hover:text-purple-300 border border-purple-400/30 rounded-lg px-2 py-1"
        >
          承認
        </button>
        <button
          onClick={() => onDelete(task.id)}
          className="text-xs text-red-400 hover:text-red-300 border border-red-400/30 rounded-lg px-2 py-1"
        >
          却下
        </button>
      </div>
    </div>
  );
}
