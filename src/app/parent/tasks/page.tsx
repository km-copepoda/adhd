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
  isActive: boolean;
  createdBy: string;
  assignedChildId: string | null;
  assignedChild: { id: string; monsterName: string | null } | null;
};

type Child = {
  id: string;
  monsterName: string | null;
};

const EMOJIS = ["⚔️", "📖", "🏃", "🧹", "🎹", "📐", "🥗", "🛏️", "🐕", "✏️"];

type FormMode = "regular" | "temporary";

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<FormMode>("regular");
  const [form, setForm] = useState({
    title: "",
    emoji: "⚔️",
    category: "STUDY" as Category,
    difficulty: "NORMAL" as Difficulty,
    repeatDays: [1, 2, 3, 4, 5] as number[],
    targetDate: "",
    assignedChildId: "",
  });

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
      if (kids.length === 1) {
        setForm((f) => ({ ...f, assignedChildId: kids[0].id }));
      }
    }
  }

  function resetForm() {
    setForm({
      title: "",
      emoji: "⚔️",
      category: "STUDY",
      difficulty: "NORMAL",
      repeatDays: [1, 2, 3, 4, 5],
      targetDate: "",
      assignedChildId: children.length === 1 ? children[0].id : "",
    });
    setEditingId(null);
    setFormMode("regular");
    setShowForm(false);
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
      // 子供申請タスクの編集時は更新と同時に承認
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
    setShowForm(true);
  }

  function toggleDay(day: number) {
    setForm((f) => ({
      ...f,
      repeatDays: f.repeatDays.includes(day)
        ? f.repeatDays.filter((d) => d !== day)
        : [...f.repeatDays, day].sort(),
    }));
  }

  const pendingTasks = tasks.filter((t) => t.createdBy === "CHILD");
  const regularTasks = tasks.filter((t) => !t.isTemporary && t.createdBy !== "CHILD");
  const temporaryTasks = tasks.filter((t) => t.isTemporary && t.createdBy !== "CHILD");

  function childName(task: Task) {
    return task.assignedChild?.monsterName || "不明";
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="font-serif text-quest-gold text-2xl tracking-wider">
            📋 タスク管理
          </h1>
          <p className="text-quest-dim text-sm mt-1">定期クエストの作成・編集</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-gold text-sm">
          + 新しいタスク
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-quest-card border border-quest-border rounded-xl p-6 mb-8">
          {/* Mode tabs */}
          {!editingId && (
            <div className="flex gap-1 mb-5 bg-quest-bg rounded-lg p-1">
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
              ? "タスクを編集"
              : formMode === "temporary"
              ? "一時タスクを作成"
              : "新しいタスクを作成"}
          </h3>

          {/* Child selector */}
          <label className="block text-quest-dim text-xs mb-1 tracking-wider">
            対象の子供
          </label>
          {children.length === 0 ? (
            <p className="text-quest-dim text-xs mb-4">子供が登録されていません</p>
          ) : children.length === 1 ? (
            <p className="text-quest-gold text-sm mb-4">{children[0].monsterName}</p>
          ) : (
            <div className="flex gap-2 mb-4 flex-wrap">
              {children.map((child) => (
                <button
                  key={child.id}
                  onClick={() => setForm((f) => ({ ...f, assignedChildId: child.id }))}
                  className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                    form.assignedChildId === child.id
                      ? "border-quest-gold bg-quest-gold/10 text-quest-gold"
                      : "border-quest-border text-quest-dim hover:border-quest-gold/20"
                  }`}
                >
                  {child.monsterName}
                </button>
              ))}
            </div>
          )}

          {/* Title */}
          <label className="block text-quest-dim text-xs mb-1 tracking-wider">
            タスク名
          </label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="例: 算数ドリルをやる"
            className="w-full bg-quest-bg border border-quest-border rounded-lg px-3 py-2 text-sm text-quest-text placeholder:text-quest-dim/50 focus:outline-none focus:border-quest-gold/30 mb-4"
          />

          {/* Emoji */}
          <label className="block text-quest-dim text-xs mb-1 tracking-wider">
            アイコン
          </label>
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
          <label className="block text-quest-dim text-xs mb-1 tracking-wider">
            カテゴリ
          </label>
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
          <label className="block text-quest-dim text-xs mb-1 tracking-wider">
            難易度
          </label>
          <div className="flex gap-2 mb-4">
            {(["EASY", "NORMAL", "HARD"] as Difficulty[]).map((diff) => {
              const label = DIFFICULTY_LABEL[diff];
              return (
                <button
                  key={diff}
                  onClick={() => setForm((f) => ({ ...f, difficulty: diff }))}
                  className={`flex-1 py-2 rounded-lg text-sm border transition-colors ${
                    form.difficulty === diff
                      ? "text-white"
                      : "border-quest-border text-quest-dim hover:border-quest-gold/20"
                  }`}
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
              <label className="block text-quest-dim text-xs mb-1 tracking-wider">
                繰り返し
              </label>
              <div className="flex gap-1 mb-6">
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
                className="w-full bg-quest-bg border border-quest-border rounded-lg px-3 py-2 text-sm text-quest-text focus:outline-none focus:border-quest-gold/30 mb-6"
              />
            </>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleSubmit}
              disabled={!form.assignedChildId || !form.title.trim()}
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
      )}

      {/* Pending (child-created) task list */}
      {pendingTasks.length > 0 && (
        <div className="mb-8">
          <h2 className="text-quest-dim text-xs tracking-wider mb-3">🙋 子供の申請中タスク</h2>
          <div className="flex flex-col gap-3">
            {pendingTasks.map((task) => {
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
                      <span className="text-blue-400/70">{childName(task)}</span>
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

      {/* Regular task list */}
      <div className="mb-8">
        <h2 className="text-quest-dim text-xs tracking-wider mb-3">📅 通常タスク</h2>
        <div className="flex flex-col gap-3">
          {regularTasks.length === 0 && !showForm && (
            <p className="text-quest-dim text-sm text-center py-6">
              通常タスクはまだありません。
            </p>
          )}
          {regularTasks.map((task) => {
            const cat = CATEGORY_LABEL[task.category];
            const diff = DIFFICULTY_LABEL[task.difficulty];
            return (
              <div
                key={task.id}
                className="bg-quest-card border border-quest-border rounded-xl p-4 flex items-center gap-4"
              >
                <div className="text-2xl">{task.emoji}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{task.title}</p>
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-quest-dim">
                    <span className="text-blue-400/70">{childName(task)}</span>
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

      {/* Temporary task list */}
      <div>
        <h2 className="text-quest-dim text-xs tracking-wider mb-3">⚡ 一時タスク</h2>
        <div className="flex flex-col gap-3">
          {temporaryTasks.length === 0 && (
            <p className="text-quest-dim text-sm text-center py-6">
              一時タスクはまだありません。
            </p>
          )}
          {temporaryTasks.map((task) => {
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
                    <span className="text-blue-400/70">{childName(task)}</span>
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
    </div>
  );
}
