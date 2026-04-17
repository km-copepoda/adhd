import { describe, it, expect } from "vitest";
import { sortAndFilterBadges, type BadgeData } from "@/lib/badgeFilter";

const makeBadge = (
  id: string,
  unlocked: boolean,
  isNew = false
): BadgeData => ({
  id,
  name: id,
  emoji: "🏅",
  description: "",
  unlocked,
  unlockedAt: unlocked ? "2026-04-01T00:00:00Z" : null,
  isNew,
});

describe("sortAndFilterBadges", () => {
  const badges: BadgeData[] = [
    makeBadge("locked1", false),
    makeBadge("unlocked1", true),
    makeBadge("new1", true, true),
    makeBadge("locked2", false),
    makeBadge("new2", true, true),
    makeBadge("unlocked2", true),
  ];

  describe("filter=all", () => {
    it("全バッジを返す", () => {
      const result = sortAndFilterBadges(badges, "all");
      expect(result).toHaveLength(6);
    });

    it("新着バッジが先頭に来る", () => {
      const result = sortAndFilterBadges(badges, "all");
      expect(result[0].isNew).toBe(true);
      expect(result[1].isNew).toBe(true);
    });

    it("新着の次に解除済み、最後に未解除が来る", () => {
      const result = sortAndFilterBadges(badges, "all");
      const ids = result.map(b => b.id);
      // new系が先頭2つ
      expect(ids.slice(0, 2)).toEqual(expect.arrayContaining(["new1", "new2"]));
      // 解除済み（非new）が中間
      expect(ids.slice(2, 4)).toEqual(expect.arrayContaining(["unlocked1", "unlocked2"]));
      // 未解除が末尾
      expect(ids.slice(4, 6)).toEqual(expect.arrayContaining(["locked1", "locked2"]));
    });
  });

  describe("filter=unlocked", () => {
    it("解除済みバッジのみ返す", () => {
      const result = sortAndFilterBadges(badges, "unlocked");
      expect(result.every(b => b.unlocked)).toBe(true);
      expect(result).toHaveLength(4);
    });

    it("新着が先頭に来る", () => {
      const result = sortAndFilterBadges(badges, "unlocked");
      expect(result[0].isNew).toBe(true);
      expect(result[1].isNew).toBe(true);
    });
  });

  describe("filter=locked", () => {
    it("未解除バッジのみ返す", () => {
      const result = sortAndFilterBadges(badges, "locked");
      expect(result.every(b => !b.unlocked)).toBe(true);
      expect(result).toHaveLength(2);
    });
  });

  describe("新着なしの場合", () => {
    const noBadges: BadgeData[] = [
      makeBadge("locked1", false),
      makeBadge("unlocked1", true),
    ];

    it("filter=all で全件返す", () => {
      const result = sortAndFilterBadges(noBadges, "all");
      expect(result).toHaveLength(2);
    });
  });
});
