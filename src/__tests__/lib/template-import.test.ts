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

describe("getInitialSelectedTitles: 残り枠 (無料プランのタスク上限)", () => {
  it("残り枠が未指定 (null) なら制限しない", () => {
    expect(getInitialSelectedTitles(templates, [], null).size).toBe(templates.length);
  });

  it("残り枠がテンプレ数より小さい場合、先頭から残り枠の件数だけ選択される", () => {
    const result = getInitialSelectedTitles(templates, [], 3);
    expect(result.size).toBe(3);
    for (const t of templates.slice(0, 3)) expect(result.has(t.title)).toBe(true);
  });

  it("作成済みテンプレは枠を消費せず、未作成の中から残り枠分だけ選ばれる", () => {
    const result = getInitialSelectedTitles(templates, [templates[0].title], 2);
    expect(result.has(templates[0].title)).toBe(false);
    expect(result.size).toBe(2);
  });

  it("残り枠が0なら何も選択されない", () => {
    expect(getInitialSelectedTitles(templates, [], 0).size).toBe(0);
  });

  it("残り枠が負数でも何も選択されない", () => {
    expect(getInitialSelectedTitles(templates, [], -2).size).toBe(0);
  });

  it("残り枠がテンプレ数以上なら全件選択される (境界: ちょうど同数)", () => {
    expect(getInitialSelectedTitles(templates, [], templates.length).size).toBe(templates.length);
    expect(getInitialSelectedTitles(templates, [], templates.length + 5).size).toBe(templates.length);
  });
});
