import { describe, it, expect } from "vitest";
import { xpRangeLabel, calcActualXP } from "@/lib/xpRange";

describe("xpRangeLabel", () => {
  it("deadline も photoBonus もない → +1pt", () => {
    expect(xpRangeLabel(false, false)).toBe("+1pt");
  });

  it("photoBonus のみ → +1〜2pt", () => {
    expect(xpRangeLabel(false, true)).toBe("+1〜2pt");
  });

  it("deadline のみ → +1〜2pt", () => {
    expect(xpRangeLabel(true, false)).toBe("+1〜2pt");
  });

  it("deadline も photoBonus もある → +1〜3pt", () => {
    expect(xpRangeLabel(true, true)).toBe("+1〜3pt");
  });

  describe("「今日やる宣言」ボーナスを含むレンジ", () => {
    it("declared=true のみ → +2pt（宣言ボーナス確定で範囲なし）", () => {
      expect(xpRangeLabel(false, false, true)).toBe("+2pt");
    });

    it("declared=true + deadline → +2〜3pt", () => {
      expect(xpRangeLabel(true, false, true)).toBe("+2〜3pt");
    });

    it("declared=true + photoBonus → +2〜3pt", () => {
      expect(xpRangeLabel(false, true, true)).toBe("+2〜3pt");
    });

    it("declared=true + deadline + photoBonus → +2〜4pt（全部入り）", () => {
      expect(xpRangeLabel(true, true, true)).toBe("+2〜4pt");
    });

    it("declared=false（デフォルト）は従来通り宣言ボーナスを含まない", () => {
      expect(xpRangeLabel(true, true, false)).toBe("+1〜3pt");
    });
  });
});

describe("calcActualXP", () => {
  it("ボーナスなし → 1pt", () => {
    expect(calcActualXP(false, false, false)).toBe(1);
  });

  it("期限ボーナスあり → 2pt", () => {
    expect(calcActualXP(true, false, false)).toBe(2);
  });

  it("写真ボーナスあり・写真添付あり → 2pt", () => {
    expect(calcActualXP(false, true, true)).toBe(2);
  });

  it("写真ボーナスあり・写真添付なし → 1pt", () => {
    expect(calcActualXP(false, true, false)).toBe(1);
  });

  it("全ボーナスあり → 3pt", () => {
    expect(calcActualXP(true, true, true)).toBe(3);
  });

  it("期限ボーナスあり・写真ボーナスあり・写真なし → 2pt", () => {
    expect(calcActualXP(true, true, false)).toBe(2);
  });

  describe("「今日やる宣言」ボーナス", () => {
    it("declared=true のみ → 2pt（基本 1 + 宣言 1）", () => {
      expect(calcActualXP(false, false, false, true)).toBe(2);
    });

    it("declared=true + 期限ボーナス → 3pt", () => {
      expect(calcActualXP(true, false, false, true)).toBe(3);
    });

    it("全ボーナス + declared=true → 4pt", () => {
      expect(calcActualXP(true, true, true, true)).toBe(4);
    });

    it("declared 引数省略時は従来通り（=false 扱い）", () => {
      expect(calcActualXP(true, true, true)).toBe(3);
    });
  });
});
