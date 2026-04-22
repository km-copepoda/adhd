"use client";

import { useState } from "react";
import {
  CATEGORY_LABEL,
  DAY_LABELS,
  TASK_TEMPLATES_BY_AGE,
  AGE_GROUPS,
  AGE_GROUP_LABEL,
  type AgeGroup,
} from "@/lib/categories";
import type { Category } from "@/types";

type FormData = {
  title: string;
  category: Category;
  repeatDays: number[];
  targetDate: string;
  photoBonus: boolean;
  carryOver: boolean;
  assignedChildId: string;
};

type FormMode = "regular" | "temporary";

type Props = {
  form: FormData;
  formMode: FormMode;
  editingId: string | null;
  isEditingPending: boolean;
  childName: string;
  onFormChange: (updater: (f: FormData) => FormData) => void;
  onFormModeChange: (mode: FormMode) => void;
  onSubmit: () => void;
  onCancel: () => void;
};

export type { FormData, FormMode };

export default function TaskForm({
  form,
  formMode,
  editingId,
  isEditingPending,
  childName,
  onFormChange,
  onFormModeChange,
  onSubmit,
  onCancel,
}: Props) {
  const [selectedAgeGroup, setSelectedAgeGroup] = useState<AgeGroup>("elementary_low");

  function toggleDay(day: number) {
    onFormChange((f) => ({
      ...f,
      repeatDays: f.repeatDays.includes(day)
        ? f.repeatDays.filter((d) => d !== day)
        : [...f.repeatDays, day].sort(),
    }));
  }

  const templates = TASK_TEMPLATES_BY_AGE[selectedAgeGroup];

  return (
    <div className="bg-quest-card border border-quest-gold/20 rounded-xl p-5 mb-4">
      {/* Mode tabs */}
      {!editingId && (
        <div className="flex gap-1 mb-4 bg-quest-bg rounded-lg p-1">
          <button
            onClick={() => onFormModeChange("regular")}
            className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors ${
              formMode === "regular"
                ? "bg-quest-gold/20 text-quest-gold border border-quest-gold/30"
                : "text-quest-dim hover:text-quest-text"
            }`}
          >
            📅 通常タスク
          </button>
          <button
            onClick={() => onFormModeChange("temporary")}
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

      {/* Template picker */}
      {!editingId && (
        <div className="mb-4">
          <label className="block text-quest-dim text-xs mb-2 tracking-wider">テンプレートから選択</label>
          {/* Age group tabs */}
          <div className="flex gap-1 mb-2 overflow-x-auto">
            {AGE_GROUPS.map((group) => (
              <button
                key={group}
                onClick={() => setSelectedAgeGroup(group)}
                className={`shrink-0 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                  selectedAgeGroup === group
                    ? "bg-quest-gold/20 text-quest-gold border border-quest-gold/30"
                    : "text-quest-dim border border-quest-border hover:text-quest-text"
                }`}
              >
                {AGE_GROUP_LABEL[group]}
              </button>
            ))}
          </div>
          {/* Template grid */}
          <div className="grid grid-cols-2 gap-1.5">
            {templates.map((tpl) => {
              const cat = CATEGORY_LABEL[tpl.category];
              const isSelected = form.title === tpl.title && form.category === tpl.category;
              return (
                <button
                  key={`${tpl.category}-${tpl.title}`}
                  onClick={() => onFormChange((f) => ({ ...f, title: tpl.title, category: tpl.category }))}
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
        onChange={(e) => onFormChange((f) => ({ ...f, title: e.target.value }))}
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
              onClick={() => onFormChange((f) => ({ ...f, category: cat }))}
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
          onClick={() => onFormChange((f) => ({ ...f, photoBonus: !f.photoBonus }))}
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

      {/* Carry-over toggle (通常タスクのみ) */}
      {formMode === "regular" && (
        <div className="flex items-center justify-between mb-4 bg-quest-bg rounded-lg px-3 py-2.5">
          <div className="flex-1 min-w-0">
            <p className="text-quest-text text-sm">🔁 未完了を翌日に持ち越す</p>
            <p className="text-quest-dim text-[11px] mt-0.5">ONにすると忘れたタスクが翌日以降も表示される</p>
          </div>
          <button
            onClick={() => onFormChange((f) => ({ ...f, carryOver: !f.carryOver }))}
            className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ml-3 overflow-hidden ${
              form.carryOver ? "bg-quest-gold" : "bg-quest-border"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                form.carryOver ? "translate-x-4" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      )}

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
            onChange={(e) => onFormChange((f) => ({ ...f, targetDate: e.target.value }))}
            className="w-full bg-quest-bg border border-quest-border rounded-lg px-3 py-2 text-sm text-quest-text focus:outline-none focus:border-quest-gold/30 mb-5"
          />
        </>
      )}

      <div className="flex gap-2">
        <button
          onClick={onSubmit}
          disabled={!form.title.trim()}
          className="btn-gold flex-1 text-sm disabled:opacity-40"
        >
          {isEditingPending ? "更新して承認" : editingId ? "更新" : "作成"}
        </button>
        <button
          onClick={onCancel}
          className="text-quest-dim text-sm border border-quest-border rounded-xl px-4 py-2 hover:border-quest-gold/20"
        >
          キャンセル
        </button>
      </div>
    </div>
  );
}
