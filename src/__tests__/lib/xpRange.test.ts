import { describe, it, expect } from "vitest";
import { xpRangeLabel } from "@/lib/xpRange";

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
