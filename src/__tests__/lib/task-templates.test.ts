import { describe, it, expect } from "vitest";
import {
  TASK_TEMPLATES_BY_AGE,
  AGE_GROUPS,
  AGE_GROUP_LABEL,
} from "@/lib/categories";

const VALID_CATEGORIES = ["STUDY", "STAMINA", "LIFE"] as const;

describe("TASK_TEMPLATES_BY_AGE", () => {
  it("AGE_GROUPS に4つのグループが定義されている", () => {
    expect(AGE_GROUPS).toHaveLength(4);
    expect(AGE_GROUPS).toContain("preschool");
    expect(AGE_GROUPS).toContain("elementary_low");
    expect(AGE_GROUPS).toContain("elementary_high");
    expect(AGE_GROUPS).toContain("middle");
  });

  it("全年齢グループにラベルが定義されている", () => {
    for (const group of AGE_GROUPS) {
      expect(AGE_GROUP_LABEL[group]).toBeDefined();
      expect(AGE_GROUP_LABEL[group].trim()).not.toBe("");
    }
  });

  it("全年齢グループにテンプレートが存在する", () => {
    for (const group of AGE_GROUPS) {
      expect(TASK_TEMPLATES_BY_AGE[group]).toBeDefined();
      expect(TASK_TEMPLATES_BY_AGE[group].length).toBeGreaterThan(0);
    }
  });

  it("全テンプレートのカテゴリが STUDY / STAMINA / LIFE のいずれか", () => {
    for (const group of AGE_GROUPS) {
      for (const tpl of TASK_TEMPLATES_BY_AGE[group]) {
        expect(VALID_CATEGORIES).toContain(tpl.category);
      }
    }
  });

  it("全テンプレートのタイトルが空でない", () => {
    for (const group of AGE_GROUPS) {
      for (const tpl of TASK_TEMPLATES_BY_AGE[group]) {
        expect(tpl.title.trim()).not.toBe("");
      }
    }
  });

  it("各年齢グループに全カテゴリ（STUDY / STAMINA / LIFE）のテンプレートがある", () => {
    for (const group of AGE_GROUPS) {
      const categories = TASK_TEMPLATES_BY_AGE[group].map((t) => t.category);
      for (const cat of VALID_CATEGORIES) {
        expect(categories).toContain(cat);
      }
    }
  });
});
