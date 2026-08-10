"use client";

import { useEffect, useState } from "react";
import { CATEGORY_LABEL, DAY_LABELS } from "@/lib/categories";
import type { Category } from "@/types";
import { alertOnApiError } from "@/lib/apiError";

type FormMode = "regular" | "temporary";

type Props = {
  onClose: () => void;
  onAdded: () => void;
};

// CHILD 向けの上限到達メッセージ。プラン名や金額には触れない (仕様書 §5.1)
const CHILD_LIMIT_MESSAGE =
  "今日はもうこれ以上タスクを追加できないよ 🐾\nママ・パパにおねがいしてね！";

export default function QuestAddForm({ onClose, onAdded }: Props) {
  const [formMode, setFormMode] = useState<FormMode>("temporary");
  const [form, setForm] = useState({
    title: "",
    category: "STUDY" as Category,
    repeatDays: [0, 1, 2, 3, 4, 5, 6] as number[],
  });
  const [submitting, setSubmitting] = useState(false);
  // 家族のプランに基づくタスク上限 (FREE=10, PREMIUM=null)。マウント時に取得
  const [taskLimit, setTaskLimit] = useState<number | null>(null);
  const [currentCount, setCurrentCount] = useState<number>(0);

  useEffect(() => {
    fetch("/api/subscription/child-task-limit")
      .then(async (r) => (r.ok ? r.json() : null))
      .then((data: { limit: number | null; current: number } | null) => {
        if (!data) return;
        setTaskLimit(data.limit);
        setCurrentCount(data.current);
      })
      .catch(() => {});
  }, []);

  async function handleAddTask() {
    // preempt: FREE 上限に達している場合はサーバ問い合わせ前に子供向けメッセージで通知
    if (taskLimit !== null && currentCount >= taskLimit) {
      alert(CHILD_LIMIT_MESSAGE);
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
    if (!(await alertOnApiError(res))) return;
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
