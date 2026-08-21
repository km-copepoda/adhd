// Issue #93: monsterLevels（進化Stage3到達カウント）のテーマ名前空間対応の互換ヘルパーテスト。
// 対象: src/lib/monsterThemes/monsterLevels.ts (未実装。実装は implementer が行う)
//
// 仕様（Issue #93 記載分の解釈。@/lib/monsterThemes/collectedPaths.ts と同じ設計思想）:
//  - 新形式は "{themeId}:{path}" 形式（例: "buddha:STUDY_STUDY_STUDY"）で保存する。
//  - 旧形式（裸のパス文字列、例: "STUDY_STUDY_STUDY"）は
//    無料テーマ（dark/light）の記録として引き続き読める後方互換を維持する。
//  - 有料テーマ（例: buddha）は旧形式（裸のパス文字列）を自分の記録として読まない
//    （無料テーマ専用の互換レイヤーであるため）。
//
// getMonsterLevel(monsterLevels, themeId, path): number
// incrementMonsterLevel(monsterLevels, themeId, path): Record<string, number>
//   ※ イミュータブル。新形式キーへ +1（旧形式の値があれば引き継ぐ）。

import { describe, it, expect } from "vitest";
import { getMonsterLevel, incrementMonsterLevel } from "@/lib/monsterThemes/monsterLevels";

const FREE_THEMES = ["dark", "light"] as const;

describe("getMonsterLevel", () => {
  it("空オブジェクトは常に 0 を返すこと", () => {
    expect(getMonsterLevel({}, "dark", "STUDY_STUDY_STUDY")).toBe(0);
    expect(getMonsterLevel({}, "buddha", "STUDY_STUDY_STUDY")).toBe(0);
  });

  describe("新形式（テーマ名前空間付き）のみの場合", () => {
    const levels = { "buddha:STUDY_STUDY_STUDY": 3, "buddha:STAMINA_STAMINA_STAMINA": 1 };

    it("該当テーマなら新形式の値を読めること", () => {
      expect(getMonsterLevel(levels, "buddha", "STUDY_STUDY_STUDY")).toBe(3);
      expect(getMonsterLevel(levels, "buddha", "STAMINA_STAMINA_STAMINA")).toBe(1);
    });

    it("別テーマの名前空間付き記録は 0 を返すこと", () => {
      expect(getMonsterLevel(levels, "dark", "STUDY_STUDY_STUDY")).toBe(0);
      expect(getMonsterLevel(levels, "light", "STUDY_STUDY_STUDY")).toBe(0);
    });

    it("記録されていない path は 0 を返すこと", () => {
      expect(getMonsterLevel(levels, "buddha", "LIFE_LIFE_LIFE")).toBe(0);
    });
  });

  describe("旧形式（裸のパス文字列）のみの場合", () => {
    const levels = { "STUDY_STUDY_STUDY": 5, "STAMINA_STAMINA_STAMINA": 2 };

    it.each(FREE_THEMES)("無料テーマ(%s)は旧形式を自分の記録として読めること", (themeId) => {
      expect(getMonsterLevel(levels, themeId, "STUDY_STUDY_STUDY")).toBe(5);
      expect(getMonsterLevel(levels, themeId, "STAMINA_STAMINA_STAMINA")).toBe(2);
    });

    it("有料テーマ(buddha)は旧形式を自分の記録として読まず 0 を返すこと", () => {
      expect(getMonsterLevel(levels, "buddha", "STUDY_STUDY_STUDY")).toBe(0);
    });

    it("記録されていない path は 0 を返すこと", () => {
      expect(getMonsterLevel(levels, "dark", "LIFE_LIFE_LIFE")).toBe(0);
    });
  });

  describe("旧形式・新形式が混在する場合", () => {
    const levels = { "STUDY_STUDY_STUDY": 4, "buddha:STAMINA_STAMINA_STAMINA": 6 };

    it("dark: 旧形式の STUDY_STUDY_STUDY は 4、新形式の STAMINA_STAMINA_STAMINA は 0", () => {
      expect(getMonsterLevel(levels, "dark", "STUDY_STUDY_STUDY")).toBe(4);
      expect(getMonsterLevel(levels, "dark", "STAMINA_STAMINA_STAMINA")).toBe(0);
    });

    it("buddha: 新形式の STAMINA_STAMINA_STAMINA は 6、旧形式の STUDY_STUDY_STUDY は 0", () => {
      expect(getMonsterLevel(levels, "buddha", "STAMINA_STAMINA_STAMINA")).toBe(6);
      expect(getMonsterLevel(levels, "buddha", "STUDY_STUDY_STUDY")).toBe(0);
    });

    it("新形式キーが存在する場合は旧形式より新形式が優先されること", () => {
      const mixed = { "STUDY_STUDY_STUDY": 1, "dark:STUDY_STUDY_STUDY": 9 };
      expect(getMonsterLevel(mixed, "dark", "STUDY_STUDY_STUDY")).toBe(9);
    });
  });
});

describe("incrementMonsterLevel", () => {
  it("境界値: 空オブジェクトに対する increment は名前空間付きキーで1になること", () => {
    const result = incrementMonsterLevel({}, "buddha", "STUDY_STUDY_STUDY");
    expect(result).toEqual({ "buddha:STUDY_STUDY_STUDY": 1 });
  });

  it("境界値: 空オブジェクトに dark で increment しても 'dark:' 名前空間付きで1になること", () => {
    const result = incrementMonsterLevel({}, "dark", "STUDY_STUDY_STUDY");
    expect(result).toEqual({ "dark:STUDY_STUDY_STUDY": 1 });
  });

  it("新形式キーが既にある場合は単純に+1すること", () => {
    const result = incrementMonsterLevel(
      { "buddha:STUDY_STUDY_STUDY": 2 },
      "buddha",
      "STUDY_STUDY_STUDY",
    );
    expect(result).toEqual({ "buddha:STUDY_STUDY_STUDY": 3 });
  });

  it("新形式キーが無く旧形式キーがある場合（無料テーマ）、旧形式の値を引き継いで+1すること", () => {
    const result = incrementMonsterLevel(
      { "STUDY_STUDY_STUDY": 3 },
      "dark",
      "STUDY_STUDY_STUDY",
    );
    // 旧形式キー自体は残ってよい。新形式キーが 3+1=4 で追加される。
    expect(result).toEqual({ "STUDY_STUDY_STUDY": 3, "dark:STUDY_STUDY_STUDY": 4 });
  });

  it("旧形式キーがあっても有料テーマ(buddha)では引き継がず1から始まること", () => {
    const result = incrementMonsterLevel(
      { "STUDY_STUDY_STUDY": 7 },
      "buddha",
      "STUDY_STUDY_STUDY",
    );
    expect(result).toEqual({ "STUDY_STUDY_STUDY": 7, "buddha:STUDY_STUDY_STUDY": 1 });
  });

  it("別パスのincrementは既存のキーに影響しないこと", () => {
    const result = incrementMonsterLevel(
      { "buddha:STUDY_STUDY_STUDY": 2 },
      "buddha",
      "STAMINA_STAMINA_STAMINA",
    );
    expect(result).toEqual({
      "buddha:STUDY_STUDY_STUDY": 2,
      "buddha:STAMINA_STAMINA_STAMINA": 1,
    });
  });

  it("イミュータブル（元のオブジェクトを変更しない）であること", () => {
    const original = { "STUDY_STUDY_STUDY": 1 };
    incrementMonsterLevel(original, "buddha", "STAMINA_STAMINA_STAMINA");
    expect(original).toEqual({ "STUDY_STUDY_STUDY": 1 });
  });

  it("複数回のincrementで正しく積み上がること", () => {
    let levels: Record<string, number> = {};
    levels = incrementMonsterLevel(levels, "buddha", "STUDY_STUDY_STUDY");
    levels = incrementMonsterLevel(levels, "buddha", "STUDY_STUDY_STUDY");
    levels = incrementMonsterLevel(levels, "dark", "STUDY_STUDY_STUDY");
    expect(levels).toEqual({
      "buddha:STUDY_STUDY_STUDY": 2,
      "dark:STUDY_STUDY_STUDY": 1,
    });
  });
});
