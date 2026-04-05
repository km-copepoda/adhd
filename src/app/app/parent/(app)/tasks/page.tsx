"use client";

import { useEffect, useState } from "react";
import { CATEGORY_LABEL, DAY_LABELS, TEMP_TASK_TEMPLATES } from "@/lib/constants";
import type { Category } from "@/types";
import LoadingSpinner from "@/components/LoadingSpinner";
import { todayStringJST, isVisibleTemporaryTask } from "@/lib/date";
import { xpRangeLabel } from "@/lib/xpRange";

type Task = {
  id: string;
  title: string;
  emoji: string;
  category: Category;
  repeatDays: number[];
  isTemporary: boolean;
  targetDate: string | null;
  requestedDate: string | null;
  isActive: boolean;
  createdBy: string;
  photoBonus: boolean;
  assignedChildId: string | null;
  assignedChild: { id: string; monsterName: string | null } | null;
  taskStreaks: { childId: string; currentStreak: number; bestStreak: number }[];
  completedToday: boolean;
};

type Child = {
  id: string;
  monsterName: string | null;
  reportDeadlineTime: string | null;
};


type FormMode = "regular" | "temporary";

const defaultForm = (childId: string) => ({
  title: "",
  category: "STUDY" as Category,
  repeatDays: [1, 2, 3, 4, 5] as number[],
  targetDate: "",
  photoBonus: false,
  assignedChildId: childId,
});

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  // openChildId: どの子供のフォームが開いているか
  const [openChildId, setOpenChildId] = useState<string | null>(null);
  const todayDow = new Date().getDay(); // 0=日 ... 6=土
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<FormMode>("regular");
  const [form, setForm] = useState(defaultForm(""));

  useEffect(() => {
    Promise.all([fetchTasks(), fetchChildren()]).finally(() => setLoading(false));
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
    const emoji = CATEGORY_LABEL[form.category].emoji;
    const body = isTemporary
      ? {
          title: form.title,
          emoji,
          category: form.category,
          isTemporary: true,
          targetDate: form.targetDate || null,
          photoBonus: form.photoBonus,
          assignedChildId: form.assignedChildId,
        }
      : {
          title: form.title,
          emoji,
          category: form.category,
          repeatDays: form.repeatDays,
          isTemporary: false,
          photoBonus: form.photoBonus,
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

  async function handleRemind(childId: string) {
    const res = await fetch("/api/push/notify-child", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ childId }),
    });
    if (res.ok) {
      alert("リマインドを送りました！");
    } else {
      const json = await res.json().catch(() => ({}));
      alert(json.error || "送信に失敗しました");
    }
  }

  function startEdit(task: Task) {
    setForm({
      title: task.title,
      category: task.category,
      repeatDays: task.repeatDays,
      targetDate: task.targetDate ? task.targetDate.slice(0, 10) : "",
      photoBonus: task.photoBonus,
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

  // 子供ごとにタスクを振り分け（完了済み・期限切れの一時タスクは除外）
  function tasksForChild(childId: string) {
    const all = tasks.filter((t) => t.assignedChildId === childId);
    const todayStr = todayStringJST();
    return {
      pending: all.filter((t) => t.createdBy === "CHILD"),
      regular: all.filter((t) => !t.isTemporary && t.createdBy !== "CHILD"),
      temporary: all.filter((t) => isVisibleTemporaryTask(t, todayStr)),
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

        {/* Template picker - temporary mode only */}
        {formMode === "temporary" && !editingId && (
          <div className="mb-4">
            <label className="block text-quest-dim text-xs mb-2 tracking-wider">テンプレートから選択</label>
            <div className="grid grid-cols-2 gap-1.5">
              {TEMP_TASK_TEMPLATES.map((tpl) => {
                const cat = CATEGORY_LABEL[tpl.category];
                const isSelected = form.title === tpl.title && form.category === tpl.category;
                return (
                  <button
                    key={`${tpl.category}-${tpl.title}`}
                    onClick={() => setForm((f) => ({ ...f, title: tpl.title, category: tpl.category }))}
                    className={`text-left px-3 py-2 rounded-lg text-xs border transition-colors ${
                      isSelected
                        ? "border-quest-gold bg-quest-gold/10 text-quest-gold"
                        : "border-quest-border text-quest-dim hover:border-quest-gold/20 hover:text-quest-text"
                    }`}
                  >
                    {cat.emoji} {tpl.title}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Title */}
        <label className="block text-quest-dim text-xs mb-1 tracking-wider">タスク名</label>
        <input
          type="text"
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          maxLength={32}
          placeholder="例: 算数ドリルをやる"
          className="w-full bg-quest-bg border border-quest-border rounded-lg px-3 py-2 text-sm text-quest-text placeholder:text-quest-dim/50 focus:outline-none focus:border-quest-gold/30 mb-4"
        />

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

        {/* Photo bonus toggle */}
        <div className="flex items-center justify-between mb-4 bg-quest-bg rounded-lg px-3 py-2.5">
          <div className="flex-1 min-w-0">
            <p className="text-quest-text text-sm">📷 写真添付を有効にする</p>
            <p className="text-quest-dim text-[11px] mt-0.5">ONにすると報告時に写真を添付できる（添付すると +1pt）</p>
          </div>
          <button
            onClick={() => setForm((f) => ({ ...f, photoBonus: !f.photoBonus }))}
            className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ml-3 overflow-hidden ${
              form.photoBonus ? "bg-quest-gold" : "bg-quest-border"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                form.photoBonus ? "translate-x-4" : "translate-x-0"
              }`}
            />
          </button>
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

  if (loading) return <LoadingSpinner />;

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
                <div className="flex gap-2">
                  <button
                    onClick={() => handleRemind(child.id)}
                    className="text-xs text-quest-dim hover:text-yellow-400 border border-quest-border hover:border-yellow-400/30 rounded-lg px-3 py-1.5 transition-colors"
                    title="今日の未完了タスクをリマインド"
                  >
                    🔔 リマインド
                  </button>
                  <button
                    onClick={() => openFormForChild(child.id)}
                    className="btn-gold text-xs px-3 py-1.5"
                  >
                    + タスク追加
                  </button>
                </div>
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
                    const assignedChild = children.find(c => c.id === task.assignedChildId);
                    return (
                      <div
                        key={task.id}
                        className="bg-quest-card border border-purple-400/30 rounded-xl p-4 flex items-center gap-4"
                      >
                        <div className="text-2xl">{task.emoji}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-1.5">
                            <p className="text-sm font-medium break-all">{task.title}</p>
                            <span className="text-[9px] text-purple-400/70 border border-purple-400/30 rounded px-1 shrink-0 mt-0.5">仮</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-[10px] text-quest-dim">
                            <span>{cat.emoji} {cat.name}</span>
                            <span>{xpRangeLabel(!!assignedChild?.reportDeadlineTime, task.photoBonus)}</span>
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
                            className="text-xs text-blue-400 hover:text-blue-300 border border-blue-400/30 rounded-lg px-2 py-1"
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
                            className="text-xs text-red-400 hover:text-red-300 border border-red-400/30 rounded-lg px-2 py-1"
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
                    const streak = (task.taskStreaks ?? []).find((s) => s.childId === child.id)?.currentStreak ?? 0;
                    const isOffDay = !task.repeatDays.includes(todayDow);
                    const assignedChild = children.find(c => c.id === task.assignedChildId);
                    return (
                      <div
                        key={task.id}
                        className={`bg-quest-card border rounded-xl p-4 flex items-center gap-4 ${
                          task.completedToday || isOffDay
                            ? "border-quest-border/30"
                            : "border-quest-border"
                        }`}
                      >
                        <div className={`text-2xl ${task.completedToday ? "opacity-40" : isOffDay ? "opacity-35" : ""}`}>{task.emoji}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-1.5">
                            <p className={`text-sm font-medium break-all ${task.completedToday ? "opacity-40" : isOffDay ? "opacity-35" : ""}`}>{task.title}</p>
                            {task.completedToday && (
                              <span className="text-[9px] text-green-400 bg-green-400/15 border border-green-400/50 rounded px-1 shrink-0 mt-0.5">
                                ✓ 完了
                              </span>
                            )}
                            {!task.completedToday && streak >= 1 && (
                              <span className="text-[9px] text-orange-400 border border-orange-400/30 rounded px-1 shrink-0">
                                🔥{streak}日
                              </span>
                            )}
                          </div>
                          <div className={`flex items-center gap-2 mt-1 text-[10px] text-quest-dim ${task.completedToday ? "opacity-40" : isOffDay ? "opacity-35" : ""}`}>
                            <span>{cat.emoji} {cat.name}</span>
                            <span>{xpRangeLabel(!!assignedChild?.reportDeadlineTime, task.photoBonus)}</span>
                          </div>
                          <div className={`flex gap-0.5 mt-1 ${task.completedToday ? "opacity-40" : isOffDay ? "opacity-35" : ""}`}>
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
                          {!task.completedToday && isOffDay && (
                            <span className="text-[9px] text-quest-dim border border-quest-border rounded px-1">
                              対象外
                            </span>
                          )}
                          <div className="flex gap-1">
                            <button
                              onClick={() => startEdit(task)}
                              className="text-xs text-blue-400 hover:text-blue-300 border border-blue-400/30 rounded-lg px-2 py-1"
                            >
                              編集
                           </button>
                           <button
                             onClick={() => handleDelete(task.id)}
                             className="text-xs text-red-400 hover:text-red-300 border border-red-400/30 rounded-lg px-2 py-1"
                           >
                             削除
                           </button>
                          </div>
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
                    const assignedChild = children.find(c => c.id === task.assignedChildId);
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
                          <p className="text-sm font-medium break-all">{task.title}</p>
                          <div className="flex items-center gap-2 mt-1 text-[10px] text-quest-dim">
                            <span>{cat.emoji} {cat.name}</span>
                            <span>{xpRangeLabel(!!assignedChild?.reportDeadlineTime, task.photoBonus)}</span>
                            <span className="text-amber-400/70">📅 {dateStr}</span>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleDelete(task.id)}
                            className="text-xs text-red-400 hover:text-red-300 border border-red-400/30 rounded-lg px-2 py-1"
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
