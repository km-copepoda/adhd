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
});
