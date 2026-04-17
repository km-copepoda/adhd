import { describe, it, expect } from "vitest";
import { getInitialSelectedTitles } from "@/components/parent/TemplateImportSection";
import { TASK_TEMPLATES_BY_AGE } from "@/lib/categories";

const templates = TASK_TEMPLATES_BY_AGE.elementary_low;

describe("getInitialSelectedTitles", () => {
  it("既存タスクがない場合、全テンプレートが選択される", () => {
    const result = getInitialSelectedTitles(templates, []);
    expect(result.size).toBe(templates.length);
    for (const t of templates) {
      expect(result.has(t.title)).toBe(true);
    }
  });

  it("既存タスクと同名のテンプレートは選択されない", () => {
    const existing = [templates[0].title, templates[1].title];
    const result = getInitialSelectedTitles(templates, existing);
    expect(result.has(templates[0].title)).toBe(false);
    expect(result.has(templates[1].title)).toBe(false);
    expect(result.size).toBe(templates.length - 2);
  });

  it("全テンプレートが既存の場合、選択数が0になる", () => {
    const existing = templates.map((t) => t.title);
    const result = getInitialSelectedTitles(templates, existing);
    expect(result.size).toBe(0);
  });

  it("テンプレートにないタイトルが existingTitles にあっても影響しない", () => {
    const existing = ["存在しないタスク"];
    const result = getInitialSelectedTitles(templates, existing);
    expect(result.size).toBe(templates.length);
  });
});
