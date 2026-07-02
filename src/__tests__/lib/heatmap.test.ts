import { describe, it, expect } from "vitest";
import { formatDate, getHeatLevel, HEAT_CLASS } from "@/lib/heatmap";

describe("formatDate", () => {
  it("YYYY-MM-DD 形式の文字列を返す", () => {
    const d = new Date(2026, 5, 2); // 2026-06-02 (月は0始まり)
    expect(formatDate(d)).toBe("2026-06-02");
  });

  it("1月・1日でも 0 埋めされる", () => {
    const d = new Date(2026, 0, 1);
    expect(formatDate(d)).toBe("2026-01-01");
  });

  it("12月・31日も正しく表現される", () => {
    const d = new Date(2026, 11, 31);
    expect(formatDate(d)).toBe("2026-12-31");
  });

  it("10月以降の月も2桁になる", () => {
    const d = new Date(2026, 9, 15);
    expect(formatDate(d)).toBe("2026-10-15");
  });
});

describe("getHeatLevel", () => {
  it("undefined の場合 none を返す", () => {
    expect(getHeatLevel(undefined)).toBe("none");
  });

  it("total が 0 の場合 none を返す", () => {
    expect(getHeatLevel({ approved: 0, skipped: 0, total: 0 })).toBe("none");
  });

  it("approved が 0 で total > 0 の場合 skip を返す", () => {
    expect(getHeatLevel({ approved: 0, skipped: 3, total: 3 })).toBe("skip");
  });

  it("100% 達成は lv6", () => {
    expect(getHeatLevel({ approved: 5, skipped: 0, total: 5 })).toBe("lv6");
  });

  it("80% 達成は lv5（境界値）", () => {
    expect(getHeatLevel({ approved: 4, skipped: 1, total: 5 })).toBe("lv5");
  });

  it("60% 達成は lv4（境界値）", () => {
    expect(getHeatLevel({ approved: 3, skipped: 2, total: 5 })).toBe("lv4");
  });

  it("40% 達成は lv3（境界値）", () => {
    expect(getHeatLevel({ approved: 2, skipped: 3, total: 5 })).toBe("lv3");
  });

  it("20% 達成は lv2（境界値）", () => {
    expect(getHeatLevel({ approved: 1, skipped: 4, total: 5 })).toBe("lv2");
  });

  it("20% 未満は lv1", () => {
    expect(getHeatLevel({ approved: 1, skipped: 0, total: 10 })).toBe("lv1");
  });
});

describe("HEAT_CLASS", () => {
  it("全てのヒートレベルに対応するクラスを持つ", () => {
    const levels = ["none", "lv1", "lv2", "lv3", "lv4", "lv5", "lv6", "skip"] as const;
    for (const level of levels) {
      expect(HEAT_CLASS[level]).toBeTruthy();
      expect(typeof HEAT_CLASS[level]).toBe("string");
    }
  });

  it("lv1〜lv6 は GitHub 貢献グラフ風の緑グラデーションを使う", () => {
    // GitHub dark theme contribution palette
    // level1 #0e4429 → level2 #006d32 → level3 #26a641 → level4 #39d353
    expect(HEAT_CLASS.lv1).toContain("#0e4429");
    expect(HEAT_CLASS.lv2).toContain("#006d32");
    expect(HEAT_CLASS.lv3).toContain("#26a641");
    expect(HEAT_CLASS.lv4).toContain("#2ea043");
    expect(HEAT_CLASS.lv5).toContain("#39d353");
    expect(HEAT_CLASS.lv6).toContain("#56d364");
  });

  it("lv1〜lv6 はいずれも teal / gold を含まない (GitHub 風の緑に統一)", () => {
    const greenLevels = ["lv1", "lv2", "lv3", "lv4", "lv5", "lv6"] as const;
    for (const level of greenLevels) {
      expect(HEAT_CLASS[level]).not.toMatch(/teal/);
      expect(HEAT_CLASS[level]).not.toMatch(/quest-gold/);
    }
  });

  it("none / skip は緑グラデーションと区別できる (背景は緑を含まない)", () => {
    // none は既存のカード背景, skip は orange 系のまま
    expect(HEAT_CLASS.none).not.toContain("#0e4429");
    expect(HEAT_CLASS.skip).toContain("orange");
  });
});
