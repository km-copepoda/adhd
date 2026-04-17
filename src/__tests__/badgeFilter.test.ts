import { describe, expect, it } from "vitest";
import { sortAndFilterBadges, isBadgeNew, type BadgeData } from "@/lib/badgeFilter";
import { ALL_BADGES } from "@/lib/badges.data";

// テスト用バッジデータ
function makeBadge(overrides: Partial<BadgeData>): BadgeData {
  return {
    id: "b1",
    name: "テストバッジ",
    emoji: "🎉",
    description: "テスト",
    unlocked: false,
    unlockedAt: null,
    isNew: false,
    ...overrides,
  };
}

describe("sortAndFilterBadges", () => {
  const badges: BadgeData[] = [
    makeBadge({ id: "locked1", unlocked: false, isNew: false }),
    makeBadge({ id: "unlocked1", unlocked: true, isNew: false, unlockedAt: "2026-01-01" }),
    makeBadge({ id: "new1", unlocked: true, isNew: true, unlockedAt: "2026-04-17" }),
    makeBadge({ id: "locked2", unlocked: false, isNew: false }),
    makeBadge({ id: "new2", unlocked: true, isNew: true, unlockedAt: "2026-04-17" }),
  ];

  it("filter=all: すべてのバッジを返す", () => {
    const result = sortAndFilterBadges(badges, "all");
    expect(result).toHaveLength(5);
  });

  it("filter=unlocked: 解除済みのバッジのみ返す", () => {
    const result = sortAndFilterBadges(badges, "unlocked");
    expect(result).toHaveLength(3);
    expect(result.every(b => b.unlocked)).toBe(true);
  });

  it("filter=locked: 未解除のバッジのみ返す", () => {
    const result = sortAndFilterBadges(badges, "locked");
    expect(result).toHaveLength(2);
    expect(result.every(b => !b.unlocked)).toBe(true);
  });

  it("ソート順: NEW > 解除済み > 未解除", () => {
    const result = sortAndFilterBadges(badges, "all");
    const firstNewIdx = result.findIndex(b => b.isNew);
    const firstUnlockedIdx = result.findIndex(b => b.unlocked && !b.isNew);
    const firstLockedIdx = result.findIndex(b => !b.unlocked);

    expect(firstNewIdx).toBeLessThan(firstUnlockedIdx);
    expect(firstUnlockedIdx).toBeLessThan(firstLockedIdx);
  });

  it("isNew なしの場合: filter=all で全件返す", () => {
    const noBadges = badges.map(b => ({ ...b, isNew: false }));
    const result = sortAndFilterBadges(noBadges, "all");
    expect(result).toHaveLength(5);
  });
});

describe("isBadgeNew", () => {
  // JST 2026-04-17 12:00 = UTC 2026-04-17 03:00
  const nowMs = new Date("2026-04-17T03:00:00Z").getTime();

  it("当日 JST に解除されたバッジは true", () => {
    // JST 2026-04-17 00:00 = UTC 2026-04-16 15:00
    expect(isBadgeNew("2026-04-16T15:00:00Z", nowMs)).toBe(true);
  });

  it("当日 JST の終端（23:59）も true", () => {
    // JST 2026-04-17 23:59 = UTC 2026-04-17 14:59
    expect(isBadgeNew("2026-04-17T14:59:00Z", nowMs)).toBe(true);
  });

  it("前日 JST に解除されたバッジは false", () => {
    // JST 2026-04-16 23:59 = UTC 2026-04-16 14:59
    expect(isBadgeNew("2026-04-16T14:59:00Z", nowMs)).toBe(false);
  });

  it("翌日 JST のバッジは false", () => {
    // JST 2026-04-18 00:00 = UTC 2026-04-17 15:00
    expect(isBadgeNew("2026-04-17T15:00:00Z", nowMs)).toBe(false);
  });

  it("null は false", () => {
    expect(isBadgeNew(null, nowMs)).toBe(false);
  });

  it("JST 日付境界（0時ちょうど）は当日扱い", () => {
    // JST 2026-04-17 00:00:00 = UTC 2026-04-16 15:00:00
    expect(isBadgeNew("2026-04-16T15:00:00Z", nowMs)).toBe(true);
  });
});

describe("ALL_BADGES - バッジIDによるルックアップ", () => {
  it("ALL_BADGES は100件定義されている", () => {
    expect(ALL_BADGES).toHaveLength(100);
  });

  it("バッジIDでバッジを検索できる", () => {
    const firstBadge = ALL_BADGES[0];
    const found = ALL_BADGES.find(b => b.id === firstBadge.id);
    expect(found).toBeDefined();
    expect(found?.name).toBe(firstBadge.name);
  });

  it("存在しないIDは undefined を返す", () => {
    const found = ALL_BADGES.find(b => b.id === "non_existent_id");
    expect(found).toBeUndefined();
  });

  it("すべてのバッジが id, name, emoji, description を持つ", () => {
    for (const badge of ALL_BADGES) {
      expect(badge.id, `${badge.name} に id がない`).toBeTruthy();
      expect(badge.name, `id=${badge.id} に name がない`).toBeTruthy();
      expect(badge.emoji, `id=${badge.id} に emoji がない`).toBeTruthy();
      expect(badge.description, `id=${badge.id} に description がない`).toBeTruthy();
    }
  });

  it("バッジIDはすべてユニーク", () => {
    const ids = ALL_BADGES.map(b => b.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ALL_BADGES.length);
  });
});
