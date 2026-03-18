"use client";

import { useEffect, useState } from "react";
import { CATEGORY_LABEL, DIFFICULTY_LABEL, XP_MAP, DAY_LABELS } from "@/lib/constants";
import type { Category, Difficulty } from "@/types";

type Task = {
  id: string;
  title: string;
  emoji: string;
  category: Category;
  difficulty: Difficulty;
  repeatDays: number[];
  isTemporary: boolean;
  targetDate: string | null;
  requestedDate: string | null;
  isActive: boolean;
  createdBy: string;
  assignedChildId: string | null;
  assignedChild: { id: string; monsterName: string | null } | null;
  taskStreaks: { childId: string; currentStreak: number; bestStreak: number }[];
};

type Child = {
  id: string;
  monsterName: string | null;
};

const EMOJIS = ["⚔️", "📖", "🏃", "🧹", "🎹", "📐", "🥗", "🛏️", "🐕", "✏️"];

type FormMode = "regular" | "temporary";

const defaultForm = (childId: string) => ({
  title: "",
  emoji: "⚔️",
  category: "STUDY" as Category,
  difficulty: "NORMAL" as Difficulty,
  repeatDays: [1, 2, 3, 4, 5] as number[],
  targetDate: "",
  assignedChildId: childId,
});

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  // openChildId: どの子供のフォームが開いているか
  const [openChildId, setOpenChildId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<FormMode>("regular");
  const [form, setForm] = useState(defaultForm(""));

  useEffect(() => {
    fetchTasks();
    fetchChildren();
  }, []);

  async function fetchTasks() {
    const res = await fetch("/api/tasks");
    if (res.ok) setTasks(await res.json());
  }

  async function fetchChildren() {
    const res = await fetch("/api/family/code");
    if (res.ok) {
      const data = await res.json();
      const kids = (data.members || []).filter((m: { role: string }) => m.role === "CHILD");
      setChildren(kids);
    }
  }

  function openFormForChild(childId: string) {
    setForm(defaultForm(childId));
    setEditingId(null);
    setFormMode("regular");
    setOpenChildId(childId);
  }

  function resetForm() {
    setEditingId(null);
    setOpenChildId(null);
    setFormMode("regular");
  }

  const isEditingPending = editingId !== null && tasks.some((t) => t.id === editingId && t.createdBy === "CHILD");

  async function handleSubmit() {
    if (!form.assignedChildId) return;
    const isTemporary = formMode === "temporary";
    const method = editingId ? "PUT" : "POST";
    const url = editingId ? `/api/tasks/${editingId}` : "/api/tasks";
    const body = isTemporary
      ? {
          title: form.title,
          emoji: form.emoji,
          category: form.category,
          difficulty: form.difficulty,
          isTemporary: true,
          targetDate: form.targetDate || null,
          assignedChildId: form.assignedChildId,
        }
      : {
          title: form.title,
          emoji: form.emoji,
          category: form.category,
          difficulty: form.difficulty,
          repeatDays: form.repeatDays,
          isTemporary: false,
          assignedChildId: form.assignedChildId,
        };

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      if (isEditingPending && editingId) {
        await fetch(`/api/tasks/${editingId}`, { method: "PATCH" });
      }
      resetForm();
      fetchTasks();
    }
  }

  async function handleApprove(id: string) {
    await fetch(`/api/tasks/${id}`, { method: "PATCH" });
    fetchTasks();
  }

  async function handleDelete(id: string) {
    if (!confirm("このタスクを削除しますか？")) return;
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    fetchTasks();
  }

  function startEdit(task: Task) {
    setForm({
      title: task.title,
      emoji: task.emoji,
      category: task.category,
      difficulty: task.difficulty,
      repeatDays: task.repeatDays,
      targetDate: task.targetDate ? task.targetDate.slice(0, 10) : "",
      assignedChildId: task.assignedChildId || "",
    });
    setFormMode(task.isTemporary ? "temporary" : "regular");
    setEditingId(task.id);
    setOpenChildId(task.assignedChildId || null);
  }

  function toggleDay(day: number) {
    setForm((f) => ({
      ...f,
      repeatDays: f.repeatDays.includes(day)
        ? f.repeatDays.filter((d) => d !== day)
        : [...f.repeatDays, day].sort(),
    }));
  }

  // 子供ごとにタスクを振り分け
  function tasksForChild(childId: string) {
    const all = tasks.filter((t) => t.assignedChildId === childId);
    return {
      pending: all.filter((t) => t.createdBy === "CHILD"),
      regular: all.filter((t) => !t.isTemporary && t.createdBy !== "CHILD"),
      temporary: all.filter((t) => t.isTemporary && t.createdBy !== "CHILD"),
    };
  }

  // フォームUI（子供セクション内に展開）
  function renderForm(childId: string, childName: string) {
    return (
      <div className="bg-quest-card border border-quest-gold/20 rounded-xl p-5 mb-4">
        {/* Mode tabs */}
        {!editingId && (
          <div className="flex gap-1 mb-4 bg-quest-bg rounded-lg p-1">
            <button
              onClick={() => setFormMode("regular")}
              className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors ${
                formMode === "regular"
                  ? "bg-quest-gold/20 text-quest-gold border border-quest-gold/30"
                  : "text-quest-dim hover:text-quest-text"
              }`}
            >
              📅 通常タスク
            </button>
            <button
              onClick={() => setFormMode("temporary")}
              className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors ${
                formMode === "temporary"
                  ? "bg-quest-gold/20 text-quest-gold border border-quest-gold/30"
                  : "text-quest-dim hover:text-quest-text"
              }`}
            >
              ⚡ 一時タスク
            </button>
          </div>
        )}

        <h3 className="text-quest-gold text-sm font-bold mb-4">
          {editingId
            ? `${childName} のタスクを編集`
            : formMode === "temporary"
            ? `${childName} に一時タスクを追加`
            : `${childName} にタスクを追加`}
        </h3>

        {/* Title */}
        <label className="block text-quest-dim text-xs mb-1 tracking-wider">タスク名</label>
        <input
          type="text"
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          placeholder="例: 算数ドリルをやる"
          className="w-full bg-quest-bg border border-quest-border rounded-lg px-3 py-2 text-sm text-quest-text placeholder:text-quest-dim/50 focus:outline-none focus:border-quest-gold/30 mb-4"
        />

        {/* Emoji */}
        <label className="block text-quest-dim text-xs mb-1 tracking-wider">アイコン</label>
        <div className="flex gap-1 mb-4 flex-wrap">
          {EMOJIS.map((e) => (
            <button
              key={e}
              onClick={() => setForm((f) => ({ ...f, emoji: e }))}
              className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center border transition-colors ${
                form.emoji === e
                  ? "border-quest-gold bg-quest-gold/10"
                  : "border-quest-border hover:border-quest-gold/30"
              }`}
            >
              {e}
            </button>
          ))}
        </div>

        {/* Category */}
        <label className="block text-quest-dim text-xs mb-1 tracking-wider">カテゴリ</label>
        <div className="flex gap-2 mb-4">
          {(["STUDY", "STAMINA", "LIFE"] as Category[]).map((cat) => {
            const label = CATEGORY_LABEL[cat];
            return (
              <button
                key={cat}
                onClick={() => setForm((f) => ({ ...f, category: cat }))}
                className={`flex-1 py-2 rounded-lg text-sm border transition-colors ${
                  form.category === cat
                    ? "border-quest-gold bg-quest-gold/10 text-quest-gold"
                    : "border-quest-border text-quest-dim hover:border-quest-gold/20"
                }`}
              >
                {label.emoji} {label.name}
              </button>
            );
          })}
        </div>

        {/* Difficulty */}
        <label className="block text-quest-dim text-xs mb-1 tracking-wider">難易度</label>
        <div className="flex gap-2 mb-4">
          {(["EASY", "NORMAL", "HARD"] as Difficulty[]).map((diff) => {
            const label = DIFFICULTY_LABEL[diff];
            return (
              <button
                key={diff}
                onClick={() => setForm((f) => ({ ...f, difficulty: diff }))}
                className={`flex-1 py-2 rounded-lg text-sm border transition-colors`}
                style={
                  form.difficulty === diff
                    ? { borderColor: label.color, backgroundColor: `${label.color}20`, color: label.color }
                    : undefined
                }
              >
                {label.name}
                <span className="text-[10px] ml-1">+{XP_MAP[diff]}XP</span>
              </button>
            );
          })}
        </div>

        {/* Regular: repeat days / Temporary: target date */}
        {formMode === "regular" ? (
          <>
            <label className="block text-quest-dim text-xs mb-1 tracking-wider">繰り返し</label>
            <div className="flex gap-1 mb-5">
              {DAY_LABELS.map((label, i) => (
                <button
                  key={i}
                  onClick={() => toggleDay(i)}
                  className={`w-9 h-9 rounded-lg text-xs font-bold border transition-colors ${
                    form.repeatDays.includes(i)
                      ? "border-quest-gold bg-quest-gold/10 text-quest-gold"
                      : "border-quest-border text-quest-dim"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <label className="block text-quest-dim text-xs mb-1 tracking-wider">
              実施日（未指定の場合は今日）
            </label>
            <input
              type="date"
              value={form.targetDate}
              onChange={(e) => setForm((f) => ({ ...f, targetDate: e.target.value }))}
              className="w-full bg-quest-bg border border-quest-border rounded-lg px-3 py-2 text-sm text-quest-text focus:outline-none focus:border-quest-gold/30 mb-5"
            />
          </>
        )}

        <div className="flex gap-2">
          <button
            onClick={handleSubmit}
            disabled={!form.title.trim()}
            className="btn-gold flex-1 text-sm disabled:opacity-40"
          >
            {isEditingPending ? "更新して承認" : editingId ? "更新" : "作成"}
          </button>
          <button
            onClick={resetForm}
            className="text-quest-dim text-sm border border-quest-border rounded-xl px-4 py-2 hover:border-quest-gold/20"
          >
            キャンセル
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-serif text-quest-gold text-2xl tracking-wider">📋 タスク管理</h1>
        <p className="text-quest-dim text-sm mt-1">定期クエストの作成・編集</p>
      </div>

      {children.length === 0 && (
        <p className="text-quest-dim text-sm text-center py-12">
          子供が登録されていません
        </p>
      )}

      {children.map((child) => {
        const name = child.monsterName || "名前未設定";
        const { pending, regular, temporary } = tasksForChild(child.id);
        const isOpen = openChildId === child.id;
        const totalCount = pending.length + regular.length + temporary.length;

        return (
          <div key={child.id} className="mb-10">
            {/* Child section header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h2 className="text-quest-text font-bold text-base">{name}</h2>
                <span className="text-quest-dim text-xs">
                  {totalCount > 0 ? `${totalCount}件` : "タスクなし"}
                </span>
              </div>
              {!isOpen && (
                <button
                  onClick={() => openFormForChild(child.id)}
                  className="btn-gold text-xs px-3 py-1.5"
                >
                  + タスク追加
                </button>
              )}
            </div>

            {/* Form for this child */}
            {isOpen && renderForm(child.id, name)}

            {/* Pending tasks */}
            {pending.length > 0 && (
              <div className="mb-4">
                <p className="text-quest-dim text-[11px] tracking-wider mb-2">🙋 申請中</p>
                <div className="flex flex-col gap-2">
                  {pending.map((task) => {
                    const cat = CATEGORY_LABEL[task.category];
                    const diff = DIFFICULTY_LABEL[task.difficulty];
                    return (
                      <div
                        key={task.id}
                        className="bg-quest-card border border-purple-400/30 rounded-xl p-4 flex items-center gap-4"
                      >
                        <div className="text-2xl">{task.emoji}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-medium truncate">{task.title}</p>
                            <span className="text-[9px] text-purple-400/70 border border-purple-400/30 rounded px-1">仮</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-[10px] text-quest-dim">
                            <span>{cat.emoji} {cat.name}</span>
                            <span style={{ color: diff.color }}>{diff.name}</span>
                            <span>+{XP_MAP[task.difficulty]}XP</span>
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
                            onClick={() => startEdit(task)}
                            className="text-xs text-quest-dim hover:text-quest-gold border border-quest-border rounded-lg px-2 py-1"
                          >
                            編集
                          </button>
                          <button
                            onClick={() => handleApprove(task.id)}
                            className="text-xs text-purple-400 hover:text-purple-300 border border-purple-400/30 rounded-lg px-2 py-1"
                          >
                            承認
                          </button>
                          <button
                            onClick={() => handleDelete(task.id)}
                            className="text-xs text-quest-dim hover:text-red-400 px-2 py-1"
                          >
                            却下
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Regular tasks */}
            {regular.length > 0 && (
              <div className="mb-4">
                <p className="text-quest-dim text-[11px] tracking-wider mb-2">📅 通常タスク</p>
                <div className="flex flex-col gap-2">
                  {regular.map((task) => {
                    const cat = CATEGORY_LABEL[task.category];
                    const diff = DIFFICULTY_LABEL[task.difficulty];
                    const streak = (task.taskStreaks ?? []).find((s) => s.childId === child.id)?.currentStreak ?? 0;
                    return (
                      <div
                        key={task.id}
                        className="bg-quest-card border border-quest-border rounded-xl p-4 flex items-center gap-4"
                      >
                        <div className="text-2xl">{task.emoji}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-medium truncate">{task.title}</p>
                            {streak >= 1 && (
                              <span className="text-[9px] text-orange-400 border border-orange-400/30 rounded px-1 shrink-0">
                                🔥{streak}日
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-[10px] text-quest-dim">
                            <span>{cat.emoji} {cat.name}</span>
                            <span style={{ color: diff.color }}>{diff.name}</span>
                            <span>+{XP_MAP[task.difficulty]}XP</span>
                          </div>
                          <div className="flex gap-0.5 mt-1">
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
                        <div className="flex gap-1">
                          <button
                            onClick={() => startEdit(task)}
                            className="text-xs text-quest-dim hover:text-quest-gold px-2 py-1"
                          >
                            編集
                          </button>
                          <button
                            onClick={() => handleDelete(task.id)}
                            className="text-xs text-quest-dim hover:text-red-400 px-2 py-1"
                          >
                            削除
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Temporary tasks */}
            {temporary.length > 0 && (
              <div className="mb-4">
                <p className="text-quest-dim text-[11px] tracking-wider mb-2">⚡ 一時タスク</p>
                <div className="flex flex-col gap-2">
                  {temporary.map((task) => {
                    const cat = CATEGORY_LABEL[task.category];
                    const diff = DIFFICULTY_LABEL[task.difficulty];
                    const dateStr = task.targetDate
                      ? new Date(task.targetDate).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" })
                      : "今日";
                    return (
                      <div
                        key={task.id}
                        className="bg-quest-card border border-quest-border rounded-xl p-4 flex items-center gap-4"
                      >
                        <div className="text-2xl">{task.emoji}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{task.title}</p>
                          <div className="flex items-center gap-2 mt-1 text-[10px] text-quest-dim">
                            <span>{cat.emoji} {cat.name}</span>
                            <span style={{ color: diff.color }}>{diff.name}</span>
                            <span>+{XP_MAP[task.difficulty]}XP</span>
                            <span className="text-amber-400/70">📅 {dateStr}</span>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleDelete(task.id)}
                            className="text-xs text-quest-dim hover:text-red-400 px-2 py-1"
                          >
                            削除
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Empty state */}
            {!isOpen && totalCount === 0 && (
              <p className="text-quest-dim/50 text-sm text-center py-4 border border-dashed border-quest-border/30 rounded-xl">
                タスクがありません
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
