import { describe, it, expect } from "vitest";
import {
  ALL_COLLECTION_ITEMS,
  getItemsBySeason,
  getRegularItemsBySeason,
  getMonthlyItems,
  getMonthForDate,
  getDrawPoolForDate,
  getCollectionItemById,
  getSeasonByMonth,
  getSeasonForDate,
  type CollectionSeason,
} from "@/lib/collectionItems";

const SEASONS: CollectionSeason[] = ["spring", "summer", "fall", "winter"];
const MONTHS: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

describe("ALL_COLLECTION_ITEMS", () => {
  it("全 140 件 (通常 80 + 月限定 60)", () => {
    expect(ALL_COLLECTION_ITEMS).toHaveLength(140);
  });

  it("id はすべて一意", () => {
    const ids = ALL_COLLECTION_ITEMS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("name はすべて一意（summer-11 改名後の状態）", () => {
    const names = ALL_COLLECTION_ITEMS.map((i) => i.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("summer-11 は「アレキサンドライト」に改名済み（真珠は m06-04 に移設）", () => {
    const s11 = getCollectionItemById("summer-11");
    expect(s11).not.toBeNull();
    expect(s11!.name).toBe("アレキサンドライト");

    const pearl = ALL_COLLECTION_ITEMS.filter((i) => i.name === "真珠");
    expect(pearl).toHaveLength(1);
    expect(pearl[0].id).toBe("m06-04");
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

  it.each(SEASONS)("%s の通常アイテムは 20 件", (season) => {
    const regular = ALL_COLLECTION_ITEMS.filter(
      (i) => i.season === season && i.month === undefined,
    );
    expect(regular).toHaveLength(20);
  });

  it.each(SEASONS)("%s の通常レア度内訳 COMMON 10 / UNCOMMON 5 / RARE 5", (season) => {
    const items = ALL_COLLECTION_ITEMS.filter(
      (i) => i.season === season && i.month === undefined,
    );
    expect(items.filter((i) => i.rarity === "COMMON")).toHaveLength(10);
    expect(items.filter((i) => i.rarity === "UNCOMMON")).toHaveLength(5);
    expect(items.filter((i) => i.rarity === "RARE")).toHaveLength(5);
  });

  it.each(SEASONS)("%s の通常アイテム id は season プレフィックスで始まる", (season) => {
    const items = ALL_COLLECTION_ITEMS.filter(
      (i) => i.season === season && i.month === undefined,
    );
    for (const item of items) {
      expect(item.id.startsWith(`${season}-`)).toBe(true);
    }
  });
});

describe("月限定アイテム", () => {
  it("60 件（各月 5 件 × 12ヶ月）", () => {
    const monthly = ALL_COLLECTION_ITEMS.filter((i) => i.month !== undefined);
    expect(monthly).toHaveLength(60);
  });

  it.each(MONTHS)("%d 月に 5 件", (month) => {
    const monthly = ALL_COLLECTION_ITEMS.filter((i) => i.month === month);
    expect(monthly).toHaveLength(5);
  });

  it.each(MONTHS)("%d 月のレア度内訳 COMMON 2 / UNCOMMON 2 / RARE 1", (month) => {
    const monthly = ALL_COLLECTION_ITEMS.filter((i) => i.month === month);
    expect(monthly.filter((i) => i.rarity === "COMMON")).toHaveLength(2);
    expect(monthly.filter((i) => i.rarity === "UNCOMMON")).toHaveLength(2);
    expect(monthly.filter((i) => i.rarity === "RARE")).toHaveLength(1);
  });

  it.each(MONTHS)("%d 月アイテムの id は m{MM}- プレフィックス", (month) => {
    const monthly = ALL_COLLECTION_ITEMS.filter((i) => i.month === month);
    const prefix = `m${String(month).padStart(2, "0")}-`;
    for (const item of monthly) {
      expect(item.id.startsWith(prefix)).toBe(true);
    }
  });

  it.each(MONTHS)("%d 月アイテムの season は月から一意に導ける", (month) => {
    const monthly = ALL_COLLECTION_ITEMS.filter((i) => i.month === month);
    for (const item of monthly) {
      expect(item.season).toBe(getSeasonByMonth(month));
    }
  });

  it("誕生石（jewel カテゴリ）は各月に少なくとも 1 つ", () => {
    // 誕生石は UNCOMMON 枠として各月に必ず1つ入れる。
    // 7月 (ルビー UNCOMMON + 織姫のはたおり糸 RARE) のように RARE が jewel の月もあるので
    // 「少なくとも1つ」で判定する。
    for (const month of MONTHS) {
      const jewels = ALL_COLLECTION_ITEMS.filter(
        (i) => i.month === month && i.category === "jewel",
      );
      expect(jewels.length).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("getItemsBySeason (シーズン UI 表示用)", () => {
  it.each(SEASONS)("%s で 35 件（通常 20 + 月限定 15）", (season) => {
    expect(getItemsBySeason(season)).toHaveLength(35);
  });
});

describe("getRegularItemsBySeason (通常アイテムのみ)", () => {
  it.each(SEASONS)("%s で 20 件", (season) => {
    const items = getRegularItemsBySeason(season);
    expect(items).toHaveLength(20);
    for (const item of items) {
      expect(item.month).toBeUndefined();
    }
  });
});

describe("getMonthlyItems", () => {
  it.each(MONTHS)("%d 月で 5 件", (month) => {
    expect(getMonthlyItems(month)).toHaveLength(5);
  });

  it("範囲外は範囲外エラー", () => {
    expect(() => getMonthlyItems(0)).toThrow();
    expect(() => getMonthlyItems(13)).toThrow();
  });
});

describe("getDrawPoolForDate (現在シーズン通常 + 現在月限定)", () => {
  it("JST 2026-07-15 → summer(20) + 7月(5) = 25 件", () => {
    const pool = getDrawPoolForDate(new Date("2026-07-15T03:00:00Z"));
    expect(pool).toHaveLength(25);
    expect(pool.filter((i) => i.month === 7)).toHaveLength(5);
    expect(pool.filter((i) => i.month === undefined && i.season === "summer")).toHaveLength(20);
    expect(pool.filter((i) => i.month === 6)).toHaveLength(0);
    expect(pool.filter((i) => i.month === 8)).toHaveLength(0);
  });

  it("月の境界: JST 8/1 00:00 は 8月扱い", () => {
    // JST 8/1 00:00 = UTC 7/31 15:00
    const pool = getDrawPoolForDate(new Date(Date.UTC(2026, 6, 31, 15, 0, 0)));
    expect(pool.filter((i) => i.month === 8)).toHaveLength(5);
    expect(pool.filter((i) => i.month === 7)).toHaveLength(0);
  });

  it("月の境界: JST 7/31 23:59 はまだ 7月扱い", () => {
    // JST 7/31 23:59 = UTC 7/31 14:59
    const pool = getDrawPoolForDate(new Date(Date.UTC(2026, 6, 31, 14, 59, 0)));
    expect(pool.filter((i) => i.month === 7)).toHaveLength(5);
  });
});

describe("getMonthForDate (JST 基準)", () => {
  it("JST 2026-07-15 → 7", () => {
    expect(getMonthForDate(new Date("2026-07-15T03:00:00Z"))).toBe(7);
  });

  it("JST 8/1 00:00 → 8 (月初境界)", () => {
    expect(getMonthForDate(new Date(Date.UTC(2026, 6, 31, 15, 0, 0)))).toBe(8);
  });

  it("JST 7/31 23:59 → 7 (境界直前)", () => {
    expect(getMonthForDate(new Date(Date.UTC(2026, 6, 31, 14, 59, 0)))).toBe(7);
  });

  it("JST 1/1 00:00 → 1 (年またぎ)", () => {
    // JST 1/1 00:00 = UTC 12/31 15:00
    expect(getMonthForDate(new Date(Date.UTC(2025, 11, 31, 15, 0, 0)))).toBe(1);
  });
});

describe("getCollectionItemById", () => {
  it("存在する id で item を返す", () => {
    const first = ALL_COLLECTION_ITEMS[0];
    expect(getCollectionItemById(first.id)).toEqual(first);
  });

  it("月限定 id も引ける", () => {
    const item = getCollectionItemById("m07-01");
    expect(item).not.toBeNull();
    expect(item!.month).toBe(7);
  });

  it("存在しない id で null", () => {
    expect(getCollectionItemById("nonexistent-xx")).toBeNull();
  });
});

describe("getSeasonByMonth", () => {
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
    const d = new Date(Date.UTC(2026, 4, 30, 15, 0, 0));
    expect(getSeasonForDate(d)).toBe("spring");
  });

  it("JST 2026-06-01 00:00 は summer (シーズン切替は月初)", () => {
    const d = new Date(Date.UTC(2026, 4, 31, 15, 0, 0));
    expect(getSeasonForDate(d)).toBe("summer");
  });

  it("JST 2026-05-31 23:59 はまだ spring", () => {
    const d = new Date(Date.UTC(2026, 4, 31, 14, 59, 0));
    expect(getSeasonForDate(d)).toBe("spring");
  });

  it("JST 12/1 → winter", () => {
    const d = new Date(Date.UTC(2026, 10, 30, 15, 0, 0));
    expect(getSeasonForDate(d)).toBe("winter");
  });
});
