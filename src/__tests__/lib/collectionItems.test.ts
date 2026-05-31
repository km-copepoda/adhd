import { describe, it, expect } from "vitest";
import {
  ALL_COLLECTION_ITEMS,
  getItemsBySeason,
  getCollectionItemById,
  getSeasonByMonth,
  getSeasonForDate,
  type CollectionSeason,
} from "@/lib/collectionItems";

const SEASONS: CollectionSeason[] = ["spring", "summer", "fall", "winter"];

describe("ALL_COLLECTION_ITEMS", () => {
  it("全 80 件 (各シーズン 20 件 × 4)", () => {
    expect(ALL_COLLECTION_ITEMS).toHaveLength(80);
  });

  it("id はすべて一意", () => {
    const ids = ALL_COLLECTION_ITEMS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("各 item は必須フィールドをすべて持つ", () => {
    for (const item of ALL_COLLECTION_ITEMS) {
      expect(item.id).toBeTruthy();
      expect(item.season).toBeTruthy();
      expect(item.category).toBeTruthy();
      expect(item.rarity).toBeTruthy();
      expect(item.name).toBeTruthy();
      expect(item.description).toBeTruthy();
      expect(item.image).toMatch(/^\/collection-items\//);
    }
  });

  it.each(SEASONS)("%s に 20 件", (season) => {
    expect(ALL_COLLECTION_ITEMS.filter((i) => i.season === season)).toHaveLength(20);
  });

  it.each(SEASONS)("%s のレア度内訳 COMMON 10 / UNCOMMON 5 / RARE 5", (season) => {
    // 仕様書 docs/未実装仕様書/treasure-collection-items.md は表で 10/6/4 と
    // 書いているが、各カテゴリーの実データは「COMMON 2 / UNCOMMON 1 / RARE 1」×5
    // で合計 10/5/5 になっている。本実装は具体的に列挙されたアイテムを優先する。
    // 抽選確率 60/30/10 はプール内件数とは独立なので運用に影響なし。
    const items = ALL_COLLECTION_ITEMS.filter((i) => i.season === season);
    expect(items.filter((i) => i.rarity === "COMMON")).toHaveLength(10);
    expect(items.filter((i) => i.rarity === "UNCOMMON")).toHaveLength(5);
    expect(items.filter((i) => i.rarity === "RARE")).toHaveLength(5);
  });

  it.each(SEASONS)("%s の id は season プレフィックスで始まる", (season) => {
    const items = ALL_COLLECTION_ITEMS.filter((i) => i.season === season);
    for (const item of items) {
      expect(item.id.startsWith(`${season}-`)).toBe(true);
    }
  });
});

describe("getItemsBySeason", () => {
  it.each(SEASONS)("%s で 20 件返す", (season) => {
    expect(getItemsBySeason(season)).toHaveLength(20);
  });
});

describe("getCollectionItemById", () => {
  it("存在する id で item を返す", () => {
    const first = ALL_COLLECTION_ITEMS[0];
    expect(getCollectionItemById(first.id)).toEqual(first);
  });

  it("存在しない id で null", () => {
    expect(getCollectionItemById("nonexistent-xx")).toBeNull();
  });
});

describe("getSeasonByMonth", () => {
  // 3-5: spring, 6-8: summer, 9-11: fall, 12,1,2: winter
  const cases: Array<[number, CollectionSeason]> = [
    [1, "winter"],
    [2, "winter"],
    [3, "spring"],
    [4, "spring"],
    [5, "spring"],
    [6, "summer"],
    [7, "summer"],
    [8, "summer"],
    [9, "fall"],
    [10, "fall"],
    [11, "fall"],
    [12, "winter"],
  ];

  it.each(cases)("month %d → %s", (m, expected) => {
    expect(getSeasonByMonth(m)).toBe(expected);
  });

  it("0 や 13 など範囲外は範囲外エラー", () => {
    expect(() => getSeasonByMonth(0)).toThrow();
    expect(() => getSeasonByMonth(13)).toThrow();
  });
});

describe("getSeasonForDate (JST 基準)", () => {
  it("UTC 0:00 の JST 5/31 は spring", () => {
    // JST 2026-05-31 00:00 → UTC 2026-05-30 15:00
    const d = new Date(Date.UTC(2026, 4, 30, 15, 0, 0));
    expect(getSeasonForDate(d)).toBe("spring");
  });

  it("JST 2026-06-01 00:00 は summer (シーズン切替は月初)", () => {
    // JST 6/1 00:00 → UTC 5/31 15:00
    const d = new Date(Date.UTC(2026, 4, 31, 15, 0, 0));
    expect(getSeasonForDate(d)).toBe("summer");
  });

  it("JST 2026-05-31 23:59 はまだ spring", () => {
    // JST 5/31 23:59 → UTC 5/31 14:59
    const d = new Date(Date.UTC(2026, 4, 31, 14, 59, 0));
    expect(getSeasonForDate(d)).toBe("spring");
  });

  it("JST 12/1 → winter", () => {
    const d = new Date(Date.UTC(2026, 10, 30, 15, 0, 0));
    expect(getSeasonForDate(d)).toBe("winter");
  });
});
