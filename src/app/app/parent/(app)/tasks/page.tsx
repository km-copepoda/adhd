"use client";

import { useEffect, useState } from "react";
import { CATEGORY_LABEL } from "@/lib/categories";
import type { Category } from "@/types";
import LoadingSpinner from "@/components/LoadingSpinner";
import { todayStringJST, isVisibleTemporaryTask } from "@/lib/date";
import { notifyApprovalsUpdated } from "@/lib/approval-events";
import SetupGuideBanner from "@/components/SetupGuideBanner";
import TaskForm from "@/components/parent/TaskForm";
import type { FormData, FormMode } from "@/components/parent/TaskForm";
import TemplateImportSection from "@/components/parent/TemplateImportSection";
import ChildSelector from "@/components/parent/ChildSelector";
import PendingTaskCard from "@/components/parent/PendingTaskCard";
import RegularTaskCard from "@/components/parent/RegularTaskCard";
import TemporaryTaskCard from "@/components/parent/TemporaryTaskCard";
import { alertOnApiError } from "@/lib/apiError";

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
  pausedAt: string | null;
  createdBy: string;
  photoBonus: boolean;
  carryOver: boolean;
  assignedChildId: string | null;
  assignedChild: { id: string; monsterName: string | null } | null;
  taskStreaks: { childId: string; currentStreak: number; bestStreak: number; lastAchievedDate: string | null }[];
  completedToday: boolean;
  lastSkippedDate: string | null;
  carryOverMissedCount: number | null;
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
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // openChildId: どの子供のフォームが開いているか
  const [openChildId, setOpenChildId] = useState<string | null>(null);
  // テンプレート一括追加UIが開いている子供のID
  const [importChildId, setImportChildId] = useState<string | null>(null);
  const todayDow = new Date().getDay(); // 0=日 ... 6=土
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<FormMode>("regular");
  const [form, setForm] = useState(defaultForm(""));

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
      setSelectedChildId((prev) => prev ?? (kids[0]?.id ?? null));
    }
  }

  useEffect(() => {
    Promise.all([fetchTasks(), fetchChildren()]).finally(() => setLoading(false));
  }, []);

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
    if (!(await alertOnApiError(res))) return;
    if (isEditingPending && editingId) {
      await fetch(`/api/tasks/${editingId}`, { method: "PATCH" });
      notifyApprovalsUpdated();
    }
    resetForm();
    fetchTasks();
  }

  async function handleApprove(id: string) {
    await fetch(`/api/tasks/${id}`, { method: "PATCH" });
    notifyApprovalsUpdated();
    fetchTasks();
  }

  async function handleDelete(id: string) {
    if (!confirm("このタスクを削除しますか？")) return;
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    notifyApprovalsUpdated();
    fetchTasks();
  }

  async function handleTogglePause(id: string, paused: boolean) {
    const res = await fetch(`/api/tasks/${id}/pause`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paused }),
    });
    if (!(await alertOnApiError(res))) return;
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

  function startEdit(task: Pick<Task, "id" | "title" | "category" | "repeatDays" | "targetDate" | "photoBonus" | "carryOver" | "assignedChildId" | "isTemporary">) {
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

      <ChildSelector
        childOptions={children}
        selectedChildId={selectedChildId}
        onSelect={(id) => {
          setSelectedChildId(id);
          // 別の子供に切り替えたらフォームを閉じる
          setOpenChildId(null);
          setImportChildId(null);
          setEditingId(null);
        }}
      />

      {children
        .filter((c) => selectedChildId === null || c.id === selectedChildId)
        .map((child) => {
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
                  {pending.map((task) => (
                    <PendingTaskCard
                      key={task.id}
                      task={task}
                      childOptions={children}
                      onEdit={startEdit}
                      onApprove={handleApprove}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Regular tasks */}
            {regular.length > 0 && (
              <div className="mb-4">
                <p className="text-quest-dim text-[11px] tracking-wider mb-2">📅 通常タスク</p>
                <div className="flex flex-col gap-2">
                  {regular.map((task) => (
                    <RegularTaskCard
                      key={task.id}
                      task={task}
                      childId={child.id}
                      childOptions={children}
                      todayDow={todayDow}
                      onEdit={startEdit}
                      onDelete={handleDelete}
                      onTogglePause={handleTogglePause}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Temporary tasks */}
            {temporary.length > 0 && (
              <div className="mb-4">
                <p className="text-quest-dim text-[11px] tracking-wider mb-2">⚡ 一時タスク</p>
                <div className="flex flex-col gap-2">
                  {temporary.map((task) => (
                    <TemporaryTaskCard
                      key={task.id}
                      task={task}
                      childOptions={children}
                      onDelete={handleDelete}
                      onTogglePause={handleTogglePause}
                    />
                  ))}
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
