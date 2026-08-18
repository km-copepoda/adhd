// Issue #73: モンスターテーマセット Stage1 — collectedPaths 名前空間化の互換ヘルパーテスト。
// 対象: src/lib/monsterThemes/collectedPaths.ts (未実装。実装は implementer が行う)
//
// 仕様（CLAUDE.md #73 issue 記載分の解釈）:
//  - 新形式は "{themeId}:{path}" 形式（例: "buddha:STUDY_STUDY_LIFE"）で保存する。
//  - 旧形式（裸のパス文字列、例: "STUDY_STUDY_LIFE"）は
//    無料テーマ（dark/light）の記録として引き続き読める後方互換を維持する。
//  - 有料テーマ（例: buddha）は旧形式（裸のパス文字列）を自分の記録として読まない
//    （無料テーマ専用の互換レイヤーであるため）。
//
// hasCollectedPath(collectedPaths, themeId, path): boolean
// addCollectedPath(collectedPaths, themeId, path): string[]  ※ イミュータブル・重複追加なし

import { describe, it, expect } from "vitest";
import { hasCollectedPath, addCollectedPath } from "@/lib/monsterThemes/collectedPaths";

const FREE_THEMES = ["dark", "light"] as const;

describe("hasCollectedPath", () => {
  it("空配列は常に false を返すこと", () => {
    expect(hasCollectedPath([], "dark", "STUDY_STUDY")).toBe(false);
    expect(hasCollectedPath([], "buddha", "STUDY_STUDY")).toBe(false);
  });

  describe("旧形式（裸のパス文字列）のみの場合", () => {
    const paths = ["STUDY_STUDY", "STAMINA_LIFE"];

    it.each(FREE_THEMES)("無料テーマ(%s)は旧形式を自分の記録として読めること", (themeId) => {
      expect(hasCollectedPath(paths, themeId, "STUDY_STUDY")).toBe(true);
      expect(hasCollectedPath(paths, themeId, "STAMINA_LIFE")).toBe(true);
    });

    it("有料テーマ(buddha)は旧形式を自分の記録として読まないこと", () => {
      expect(hasCollectedPath(paths, "buddha", "STUDY_STUDY")).toBe(false);
    });

    it("記録されていない path は false を返すこと", () => {
      expect(hasCollectedPath(paths, "dark", "LIFE_LIFE")).toBe(false);
    });
  });

  describe("新形式（テーマ名前空間付き）のみの場合", () => {
    const paths = ["buddha:STUDY_STUDY", "buddha:STAMINA_LIFE"];

    it("該当テーマなら新形式を読めること", () => {
      expect(hasCollectedPath(paths, "buddha", "STUDY_STUDY")).toBe(true);
      expect(hasCollectedPath(paths, "buddha", "STAMINA_LIFE")).toBe(true);
    });

    it("別テーマの名前空間付き記録は false を返すこと", () => {
      expect(hasCollectedPath(paths, "dark", "STUDY_STUDY")).toBe(false);
      expect(hasCollectedPath(paths, "light", "STUDY_STUDY")).toBe(false);
    });
  });

  describe("旧形式・新形式が混在する場合", () => {
    const paths = ["STUDY_STUDY", "buddha:STAMINA_LIFE"];

    it("dark: 旧形式の STUDY_STUDY は true、新形式の STAMINA_LIFE は false", () => {
      expect(hasCollectedPath(paths, "dark", "STUDY_STUDY")).toBe(true);
      expect(hasCollectedPath(paths, "dark", "STAMINA_LIFE")).toBe(false);
    });

    it("buddha: 新形式の STAMINA_LIFE は true、旧形式の STUDY_STUDY は false", () => {
      expect(hasCollectedPath(paths, "buddha", "STAMINA_LIFE")).toBe(true);
      expect(hasCollectedPath(paths, "buddha", "STUDY_STUDY")).toBe(false);
    });
  });
});

describe("addCollectedPath", () => {
  it("空配列に buddha で追加すると名前空間付きの新形式で1件追加されること", () => {
    const result = addCollectedPath([], "buddha", "STUDY_STUDY");
    expect(result).toEqual(["buddha:STUDY_STUDY"]);
  });

  it("空配列に dark で追加しても 'dark:' 名前空間付きで追加されること", () => {
    const result = addCollectedPath([], "dark", "STUDY_STUDY");
    expect(result).toEqual(["dark:STUDY_STUDY"]);
  });

  it("既に旧形式で記録済み（dark扱い）の場合は重複追加しないこと", () => {
    const result = addCollectedPath(["STUDY_STUDY"], "dark", "STUDY_STUDY");
    expect(result).toEqual(["STUDY_STUDY"]);
  });

  it("既に新形式で記録済みの場合は重複追加しないこと", () => {
    const result = addCollectedPath(["buddha:STUDY_STUDY"], "buddha", "STUDY_STUDY");
    expect(result).toEqual(["buddha:STUDY_STUDY"]);
  });

  it("旧形式で記録済みでも別テーマ(buddha)なら新たに名前空間付きで追加されること", () => {
    const result = addCollectedPath(["STUDY_STUDY"], "buddha", "STUDY_STUDY");
    expect(result).toEqual(["STUDY_STUDY", "buddha:STUDY_STUDY"]);
  });

  it("元の配列を破壊的に変更しないこと（イミュータブル）", () => {
    const original = ["STUDY_STUDY"];
    addCollectedPath(original, "buddha", "STAMINA_LIFE");
    expect(original).toEqual(["STUDY_STUDY"]);
  });

  it("複数回の追加で配列が正しく積み上がること", () => {
    let paths: string[] = [];
    paths = addCollectedPath(paths, "buddha", "STUDY_STUDY");
    paths = addCollectedPath(paths, "buddha", "STAMINA_LIFE");
    paths = addCollectedPath(paths, "dark", "LIFE_LIFE");
    expect(paths.sort()).toEqual(
      ["buddha:STUDY_STUDY", "buddha:STAMINA_LIFE", "dark:LIFE_LIFE"].sort(),
    );
  });
});
