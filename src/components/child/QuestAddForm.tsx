"use client";

import { useEffect, useState } from "react";
import { CATEGORY_LABEL, DAY_LABELS } from "@/lib/categories";
import type { Category } from "@/types";
import { alertChildPlanLimit } from "@/lib/apiError";

type FormMode = "regular" | "temporary";

type Props = {
  onClose: () => void;
  onAdded: () => void;
};

// 数値・プラン名を含まない固定文言 (monetization-plan.md §5.1: 子供に課金UIを見せない)。
const CHILD_TASK_LIMIT_MESSAGE = "これいじょうタスクをふやせないよ。ママ・パパにおねがいしてね！";

export default function QuestAddForm({ onClose, onAdded }: Props) {
  const [formMode, setFormMode] = useState<FormMode>("temporary");
  const [form, setForm] = useState({
    title: "",
    category: "STUDY" as Category,
    repeatDays: [0, 1, 2, 3, 4, 5, 6] as number[],
  });
  const [submitting, setSubmitting] = useState(false);
  // 追加ボタンの preempt チェック用 (null = 未取得/取得失敗 = フェイルオープン)。
  const [limitInfo, setLimitInfo] = useState<{ limit: number | null; current: number } | null>(
    null,
  );

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/subscription/child-task-limit");
        if (res.ok) {
          const data = await res.json();
          setLimitInfo({
            limit: typeof data.limit === "number" ? data.limit : null,
            current: typeof data.current === "number" ? data.current : 0,
          });
        }
      } catch {
        // フェイルオープン: 取得失敗時は limitInfo=null のまま。サーバ403が最終ガード。
      }
    })();
  }, []);

  async function handleAddTask() {
    if (limitInfo && limitInfo.limit !== null && limitInfo.current >= limitInfo.limit) {
      alert(CHILD_TASK_LIMIT_MESSAGE);
      return;
    }
    setSubmitting(true);
    const isTemporary = formMode === "temporary";
    const emoji = CATEGORY_LABEL[form.category].emoji;
    const body = isTemporary
      ? {
          title: form.title,
          emoji,
          category: form.category,
          isTemporary: true,
        }
      : {
          title: form.title,
          emoji,
          category: form.category,
          isTemporary: false,
          repeatDays: form.repeatDays,
        };

    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSubmitting(false);
    if (!(await alertChildPlanLimit(res, CHILD_TASK_LIMIT_MESSAGE))) return;
    onClose();
    setForm({ title: "", category: "STUDY", repeatDays: [0, 1, 2, 3, 4, 5, 6] });
    onAdded();
  }

  function toggleDay(day: number) {
    setForm((f) => ({
      ...f,
      repeatDays: f.repeatDays.includes(day)
        ? f.repeatDays.filter((d) => d !== day)
        : [...f.repeatDays, day].sort(),
    }));
  }

  return (
    <div className="bg-quest-card border border-quest-border rounded-xl p-4 mb-6">
      {/* Mode tabs */}
      <div className="flex gap-1 mb-4 bg-quest-bg rounded-lg p-1">
        <button
          onClick={() => setFormMode("temporary")}
          className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${
            formMode === "temporary"
              ? "bg-quest-gold/20 text-quest-gold border border-quest-gold/30"
              : "text-quest-dim"
          }`}
        >
          ⚡ 一時タスク
        </button>
        <button
          onClick={() => setFormMode("regular")}
          className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${
            formMode === "regular"
              ? "bg-quest-gold/20 text-quest-gold border border-quest-gold/30"
              : "text-quest-dim"
          }`}
        >
          📅 通常タスク
        </button>
      </div>

      <p className="text-quest-dim text-[10px] mb-3">
        {formMode === "temporary"
          ? "今日だけ表示されるタスクを追加します"
          : "毎週繰り返す自分のタスクを追加します"}
      </p>

      {/* Title */}
      <input
        type="text"
        value={form.title}
        onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
        maxLength={32}
        placeholder="タスク名を入力..."
        className="w-full bg-quest-bg border border-quest-border rounded-lg px-3 py-2 text-sm text-quest-text placeholder:text-quest-dim/50 focus:outline-none focus:border-quest-gold/30 mb-3"
      />

      {/* Category */}
      <div className="flex gap-1.5 mb-3">
        {(["STUDY", "STAMINA", "LIFE"] as Category[]).map((cat) => {
          const label = CATEGORY_LABEL[cat];
          return (
            <button
              key={cat}
              onClick={() => setForm((f) => ({ ...f, category: cat }))}
              className={`flex-1 py-1.5 rounded-lg text-xs border transition-colors ${
                form.category === cat
                  ? "border-quest-gold bg-quest-gold/10 text-quest-gold"
                  : "border-quest-border text-quest-dim"
              }`}
            >
              {label.emoji} {label.name}
            </button>
          );
        })}
      </div>

      {/* Repeat days (regular only) */}
      {formMode === "regular" && (
        <div className="flex gap-1 mb-3">
          {DAY_LABELS.map((label, i) => (
            <button
              key={i}
              onClick={() => toggleDay(i)}
              className={`w-8 h-8 rounded-lg text-xs font-bold border transition-colors ${
                form.repeatDays.includes(i)
                  ? "border-quest-gold bg-quest-gold/10 text-quest-gold"
                  : "border-quest-border text-quest-dim"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={handleAddTask}
          disabled={!form.title.trim() || submitting}
          className="btn-gold flex-1 text-xs py-2 disabled:opacity-40"
        >
          {submitting ? "追加中..." : "追加する"}
        </button>
        <button
          onClick={onClose}
          className="text-quest-dim text-xs border border-quest-border rounded-xl px-3 py-2"
        >
          キャンセル
        </button>
      </div>
    </div>
  );
}
