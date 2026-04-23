"use client";

import { useEffect, useState } from "react";
import { CATEGORY_LABEL, DAY_LABELS } from "@/lib/categories";
import type { Category } from "@/types";
import LoadingSpinner from "@/components/LoadingSpinner";
import { todayStringJST, isVisibleTemporaryTask } from "@/lib/date";
import { xpRangeLabel } from "@/lib/xpRange";
import { notifyApprovalsUpdated } from "@/lib/approval-events";
import SetupGuideBanner from "@/components/SetupGuideBanner";
import TaskForm from "@/components/parent/TaskForm";
import type { FormData, FormMode } from "@/components/parent/TaskForm";
import TemplateImportSection from "@/components/parent/TemplateImportSection";

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
  carryOver: boolean;
  assignedChildId: string | null;
  assignedChild: { id: string; monsterName: string | null } | null;
  taskStreaks: { childId: string; currentStreak: number; bestStreak: number }[];
  completedToday: boolean;
};

type Child = {
  id: string;
  monsterName: string | null;
  reportDeadlineTime: string | null;
  lastLoginDate: string | null;
};

const defaultForm = (childId: string): FormData => ({
  title: "",
  category: "STUDY" as Category,
  repeatDays: [1, 2, 3, 4, 5] as number[],
  targetDate: "",
  photoBonus: false,
  carryOver: false,
  assignedChildId: childId,
});

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  // openChildId: どの子供のフォームが開いているか
  const [openChildId, setOpenChildId] = useState<string | null>(null);
  // テンプレート一括追加UIが開いている子供のID
  const [importChildId, setImportChildId] = useState<string | null>(null);
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
    setImportChildId(null);
  }

  function openImportForChild(childId: string) {
    setImportChildId(childId);
    setOpenChildId(null);
    setEditingId(null);
  }

  function resetForm() {
    setEditingId(null);
    setOpenChildId(null);
    setImportChildId(null);
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
          carryOver: form.carryOver,
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
        notifyApprovalsUpdated();
      }
      resetForm();
      fetchTasks();
    }
  }

  async function handleApprove(id: string) {
    await fetch(`/api/tasks/${id}`, { method: "PATCH" });
    notifyApprovalsUpdated();
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
      carryOver: task.carryOver,
      assignedChildId: task.assignedChildId || "",
    });
    setFormMode(task.isTemporary ? "temporary" : "regular");
    setEditingId(task.id);
    setOpenChildId(task.assignedChildId || null);
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

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-serif text-quest-gold text-2xl tracking-wider">📋 タスク管理</h1>
        <p className="text-quest-dim text-sm mt-1">定期クエストの作成・編集</p>
      </div>

      <SetupGuideBanner progress={{
        hasChild: children.length > 0,
        hasTask: tasks.length > 0,
        childLoggedIn: children.some((c) => c.lastLoginDate !== null),
      }} />

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

        const isImporting = importChildId === child.id;

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
              {!isOpen && !isImporting && (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleRemind(child.id)}
                    className="text-xs text-quest-dim hover:text-yellow-400 border border-quest-border hover:border-yellow-400/30 rounded-lg px-3 py-1.5 transition-colors"
                    title="今日の未完了タスクをリマインド"
                  >
                    🔔 リマインド
                  </button>
                  <button
                    onClick={() => openImportForChild(child.id)}
                    className="text-xs text-quest-dim hover:text-quest-text border border-quest-border hover:border-quest-gold/20 rounded-lg px-3 py-1.5 transition-colors"
                  >
                    📋 テンプレート
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

            {/* Template import for this child */}
            {isImporting && (
              <TemplateImportSection
                childId={child.id}
                existingTitles={[...pending, ...regular].map((t) => t.title)}
                onImported={() => { resetForm(); fetchTasks(); }}
                onCancel={resetForm}
              />
            )}

            {/* Form for this child */}
            {isOpen && (
              <TaskForm
                form={form}
                formMode={formMode}
                editingId={editingId}
                isEditingPending={isEditingPending}
                childName={name}
                onFormChange={setForm}
                onFormModeChange={setFormMode}
                onSubmit={handleSubmit}
                onCancel={resetForm}
              />
            )}

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
                            {task.photoBonus && (
                              <span title="写真添付あり" className="text-quest-gold/70">📷</span>
                            )}
                            {task.carryOver && (
                              <span title="未完了を翌日に持ち越す" className="text-blue-400/70">🔁</span>
                            )}
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
                            {task.photoBonus && (
                              <span title="写真添付あり" className="text-quest-gold/70">📷</span>
                            )}
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
            {!isOpen && !isImporting && totalCount === 0 && (
              <div className="text-center py-6 border border-dashed border-quest-border/30 rounded-xl">
                <p className="text-quest-dim/50 text-sm mb-3">タスクがありません</p>
                <div className="flex gap-2 justify-center">
                  <button
                    onClick={() => openImportForChild(child.id)}
                    className="text-xs text-quest-gold border border-quest-gold/30 rounded-lg px-3 py-1.5 hover:bg-quest-gold/5 transition-colors"
                  >
                    📋 テンプレートから始める
                  </button>
                  <button
                    onClick={() => openFormForChild(child.id)}
                    className="text-xs text-quest-dim border border-quest-border rounded-lg px-3 py-1.5 hover:text-quest-text transition-colors"
                  >
                    ✏️ 自分で作る
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
