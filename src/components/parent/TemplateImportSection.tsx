"use client";

import { useState } from "react";
import {
  CATEGORY_LABEL,
  DAY_LABELS,
  TASK_TEMPLATES_BY_AGE,
  AGE_GROUPS,
  AGE_GROUP_LABEL,
  type AgeGroup,
  type TaskPreset,
} from "@/lib/categories";

type Props = {
  childId: string;
  existingTitles: string[];
  onImported: () => void;
  onCancel: () => void;
};

const DEFAULT_REPEAT_DAYS = [1, 2, 3, 4, 5]; // 月〜金

export function getInitialSelectedTitles(
  templates: TaskPreset[],
  existingTitles: string[]
): Set<string> {
  const existingSet = new Set(existingTitles);
  return new Set(templates.filter((t) => !existingSet.has(t.title)).map((t) => t.title));
}

export default function TemplateImportSection({
  childId,
  existingTitles,
  onImported,
  onCancel,
}: Props) {
  const [selectedAgeGroup, setSelectedAgeGroup] = useState<AgeGroup>("elementary_low");
  const [selectedTitles, setSelectedTitles] = useState<Set<string>>(
    () => getInitialSelectedTitles(TASK_TEMPLATES_BY_AGE.elementary_low, existingTitles)
  );
  const [repeatDaysMap, setRepeatDaysMap] = useState<Record<string, number[]>>(
    () =>
      Object.fromEntries(
        TASK_TEMPLATES_BY_AGE.elementary_low.map((t) => [t.title, DEFAULT_REPEAT_DAYS])
      )
  );
  const [loading, setLoading] = useState(false);

  const existingSet = new Set(existingTitles);

  function handleAgeGroupChange(group: AgeGroup) {
    setSelectedAgeGroup(group);
    const templates = TASK_TEMPLATES_BY_AGE[group];
    setSelectedTitles(getInitialSelectedTitles(templates, existingTitles));
    setRepeatDaysMap(
      Object.fromEntries(templates.map((t) => [t.title, DEFAULT_REPEAT_DAYS]))
    );
  }

  function toggleTemplate(title: string) {
    setSelectedTitles((prev) => {
      const next = new Set(prev);
      if (next.has(title)) {
        next.delete(title);
      } else {
        next.add(title);
      }
      return next;
    });
  }

  function toggleDay(title: string, day: number) {
    setRepeatDaysMap((prev) => {
      const days = prev[title] ?? DEFAULT_REPEAT_DAYS;
      const next = days.includes(day) ? days.filter((d) => d !== day) : [...days, day].sort();
      return { ...prev, [title]: next };
    });
  }

  function selectAll() {
    setSelectedTitles(
      getInitialSelectedTitles(TASK_TEMPLATES_BY_AGE[selectedAgeGroup], existingTitles)
    );
  }

  function deselectAll() {
    setSelectedTitles(new Set());
  }

  async function handleImport() {
    const templates = TASK_TEMPLATES_BY_AGE[selectedAgeGroup].filter((t) =>
      selectedTitles.has(t.title)
    );
    if (templates.length === 0) return;

    setLoading(true);
    const tasks = templates.map((t: TaskPreset) => ({
      title: t.title,
      category: t.category,
      repeatDays: repeatDaysMap[t.title] ?? DEFAULT_REPEAT_DAYS,
    }));

    const res = await fetch("/api/tasks/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignedChildId: childId, tasks }),
    });
    setLoading(false);

    if (res.ok) {
      onImported();
    }
  }

  const templates = TASK_TEMPLATES_BY_AGE[selectedAgeGroup];
  const selectedCount = selectedTitles.size;

  return (
    <div className="bg-quest-card border border-quest-gold/20 rounded-xl p-5 mb-4">
      <h3 className="text-quest-gold text-sm font-bold mb-1">📋 テンプレートから一括追加</h3>
      <p className="text-quest-dim text-xs mb-4">年齢グループを選んでタスクをまとめて追加できます</p>

      {/* Age group tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto">
        {AGE_GROUPS.map((group) => (
          <button
            key={group}
            onClick={() => handleAgeGroupChange(group)}
            className={`shrink-0 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              selectedAgeGroup === group
                ? "bg-quest-gold/20 text-quest-gold border border-quest-gold/30"
                : "text-quest-dim border border-quest-border hover:text-quest-text"
            }`}
          >
            {AGE_GROUP_LABEL[group]}
          </button>
        ))}
      </div>

      {/* Select all / Deselect all */}
      <div className="flex gap-2 mb-3">
        <button
          onClick={selectAll}
          className="text-[11px] text-quest-dim hover:text-quest-text underline"
        >
          未追加をすべて選択
        </button>
        <span className="text-quest-dim/30 text-[11px]">|</span>
        <button
          onClick={deselectAll}
          className="text-[11px] text-quest-dim hover:text-quest-text underline"
        >
          すべて解除
        </button>
      </div>

      {/* Template list with checkboxes and repeat day selector */}
      <div className="flex flex-col gap-2 mb-5">
        {templates.map((tpl) => {
          const cat = CATEGORY_LABEL[tpl.category];
          const isExisting = existingSet.has(tpl.title);
          const isChecked = selectedTitles.has(tpl.title);
          const days = repeatDaysMap[tpl.title] ?? DEFAULT_REPEAT_DAYS;
          return (
            <div
              key={tpl.title}
              className={`border rounded-xl p-3 transition-colors ${
                isChecked ? "border-quest-gold/30 bg-quest-gold/5" : "border-quest-border/40 opacity-50"
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="checkbox"
                  id={`tpl-${tpl.title}`}
                  checked={isChecked}
                  onChange={() => toggleTemplate(tpl.title)}
                  className="w-4 h-4 accent-quest-gold"
                />
                <label
                  htmlFor={`tpl-${tpl.title}`}
                  className="text-sm text-quest-text cursor-pointer select-none"
                >
                  {cat.emoji} {tpl.title}
                </label>
                <span className="text-[10px] text-quest-dim">{cat.name}</span>
                {isExisting && (
                  <span className="text-[9px] text-green-400 border border-green-400/30 rounded px-1 ml-auto shrink-0">
                    作成済
                  </span>
                )}
                {!isExisting && <span className="ml-auto" />}
              </div>
              {isChecked && (
                <div className="flex gap-1 ml-6">
                  {DAY_LABELS.map((label, i) => (
                    <button
                      key={i}
                      onClick={() => toggleDay(tpl.title, i)}
                      className={`w-7 h-7 rounded text-[10px] font-bold border transition-colors ${
                        days.includes(i)
                          ? "border-quest-gold bg-quest-gold/10 text-quest-gold"
                          : "border-quest-border/40 text-quest-dim/50"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleImport}
          disabled={selectedCount === 0 || loading}
          className="btn-gold flex-1 text-sm disabled:opacity-40"
        >
          {loading ? "追加中..." : `${selectedCount}件を追加`}
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
