import { describe, it, expect } from "vitest";
import { meetsTreasureRequirement, isAllComplete } from "@/lib/treasureEligibility";

describe("meetsTreasureRequirement", () => {
  describe("totalCount <= 0 は常に false (#267)", () => {
    it.each([1, 3, 0])("totalCount=0, reportedCount=0, minTasks=%i", (minTasks) => {
      expect(meetsTreasureRequirement({ reportedCount: 0, totalCount: 0, minTasks })).toBe(false);
    });
    it("totalCount=0 で reportedCount>0 (不整合入力) でも false", () => {
      expect(meetsTreasureRequirement({ reportedCount: 1, totalCount: 0, minTasks: 1 })).toBe(false);
    });
    it("totalCount が負数でも false", () => {
      expect(meetsTreasureRequirement({ reportedCount: 0, totalCount: -1, minTasks: 1 })).toBe(false);
    });
  });

  describe("通常ケース (minTasks <= totalCount)", () => {
    it("reportedCount = minTasks - 1 → false", () => {
      expect(meetsTreasureRequirement({ reportedCount: 1, totalCount: 5, minTasks: 2 })).toBe(false);
    });
    it("reportedCount = minTasks ちょうど → true", () => {
      expect(meetsTreasureRequirement({ reportedCount: 2, totalCount: 5, minTasks: 2 })).toBe(true);
    });
    it("reportedCount = totalCount (全完了) → true", () => {
      expect(meetsTreasureRequirement({ reportedCount: 5, totalCount: 5, minTasks: 2 })).toBe(true);
    });
    it("reportedCount が totalCount を超過しても true", () => {
      expect(meetsTreasureRequirement({ reportedCount: 6, totalCount: 5, minTasks: 2 })).toBe(true);
    });
    it("totalCount=1, minTasks=1: reportedCount=0 → false / 1 → true", () => {
      expect(meetsTreasureRequirement({ reportedCount: 0, totalCount: 1, minTasks: 1 })).toBe(false);
      expect(meetsTreasureRequirement({ reportedCount: 1, totalCount: 1, minTasks: 1 })).toBe(true);
    });
  });

  describe("少タスク日救済 (minTasks > totalCount)", () => {
    it("totalCount=1, minTasks=3: reportedCount=1 → true", () => {
      expect(meetsTreasureRequirement({ reportedCount: 1, totalCount: 1, minTasks: 3 })).toBe(true);
    });
    it("totalCount=1, minTasks=3: reportedCount=0 → false", () => {
      expect(meetsTreasureRequirement({ reportedCount: 0, totalCount: 1, minTasks: 3 })).toBe(false);
    });
    it("totalCount=2, minTasks=5: reportedCount=1 → false / 2 → true", () => {
      expect(meetsTreasureRequirement({ reportedCount: 1, totalCount: 2, minTasks: 5 })).toBe(false);
      expect(meetsTreasureRequirement({ reportedCount: 2, totalCount: 2, minTasks: 5 })).toBe(true);
    });
  });

  describe("防御ケース minTasks=0 (必要数の下限は 1)", () => {
    it("reportedCount=0 → false (未達成で宝箱を作らない)", () => {
      expect(meetsTreasureRequirement({ reportedCount: 0, totalCount: 3, minTasks: 0 })).toBe(false);
    });
    it("reportedCount=1 → true", () => {
      expect(meetsTreasureRequirement({ reportedCount: 1, totalCount: 3, minTasks: 0 })).toBe(true);
    });
  });
});

describe("isAllComplete", () => {
  it("totalCount=0 → false (0/0 を全完了扱いしない)", () => {
    expect(isAllComplete({ reportedCount: 0, totalCount: 0 })).toBe(false);
  });
  it("totalCount が負数 → false", () => {
    expect(isAllComplete({ reportedCount: 0, totalCount: -1 })).toBe(false);
  });
  it("reportedCount=0, totalCount=1 → false", () => {
    expect(isAllComplete({ reportedCount: 0, totalCount: 1 })).toBe(false);
  });
  it("reportedCount=1, totalCount=1 → true", () => {
    expect(isAllComplete({ reportedCount: 1, totalCount: 1 })).toBe(true);
  });
  it("reportedCount = totalCount - 1 → false", () => {
    expect(isAllComplete({ reportedCount: 2, totalCount: 3 })).toBe(false);
  });
  it("reportedCount = totalCount → true", () => {
    expect(isAllComplete({ reportedCount: 3, totalCount: 3 })).toBe(true);
  });
  it("reportedCount > totalCount (超過) → true", () => {
    expect(isAllComplete({ reportedCount: 4, totalCount: 3 })).toBe(true);
  });
});
