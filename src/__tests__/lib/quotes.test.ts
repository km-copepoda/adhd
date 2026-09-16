import { describe, it, expect } from "vitest";
import { dailyQuoteIndex, getDailyQuote } from "@/lib/quotes";
import { QUOTES } from "@/lib/quotes.data";
import type { Quote } from "@/lib/quotes.data";

const LENGTH = QUOTES.length;

// ハッシュ化アルゴリズム（epochDay を種とする決定的ハッシュ）を前提としたゴールデン値。
// データ件数（QUOTES.length）が将来変わってもこの回帰検証自体は成立するよう、
// length を 176 に固定して呼び出す。
const FIXED_LENGTH = 176;

describe("dailyQuoteIndex", () => {
  it("同一JST日付を複数回渡すと常に同じインデックスを返す（決定性）", () => {
    const d = new Date("2026-03-10T03:00:00Z"); // JST 3/10 12:00
    const i1 = dailyQuoteIndex(d, LENGTH);
    const i2 = dailyQuoteIndex(new Date(d.getTime()), LENGTH);
    expect(i1).toBe(i2);
  });

  it("ゴールデン値: 既知の日付に対して期待したインデックスを返す（length=176固定）", () => {
    const cases: Array<[string, number]> = [
      ["2026-01-01T14:59:59Z", 103], // JST 1/1 23:59:59
      ["2026-01-01T15:00:00Z", 40], // JST 1/2 00:00:00
      ["2025-12-31T03:00:00Z", 47], // JST 12/31 12:00
      ["2026-01-01T03:00:00Z", 103], // JST 1/1 12:00
      ["2028-02-28T03:00:00Z", 130],
      ["2028-02-29T03:00:00Z", 151],
      ["2028-03-01T03:00:00Z", 132],
      ["1999-12-31T00:00:00Z", 169],
      ["2000-01-01T00:00:00Z", 43],
      ["2038-01-19T00:00:00Z", 63],
      ["2100-01-01T00:00:00Z", 31],
      ["1969-01-01T00:00:00Z", 43], // 1970年以前
    ];
    for (const [iso, expected] of cases) {
      expect(dailyQuoteIndex(new Date(iso), FIXED_LENGTH)).toBe(expected);
    }
  });

  it("JST日付境界: 23:59と翌0:00で日付が変わり、インデックスも変化する", () => {
    const before = new Date("2026-01-01T14:59:59Z"); // JST 1/1 23:59:59
    const after = new Date("2026-01-01T15:00:00Z"); // JST 1/2 00:00:00
    const beforeEpochDay = Math.floor(
      (before.getTime() + 9 * 60 * 60 * 1000) / 86400000,
    );
    const afterEpochDay = Math.floor(
      (after.getTime() + 9 * 60 * 60 * 1000) / 86400000,
    );
    expect(afterEpochDay).toBe(beforeEpochDay + 1);
    // 日付が変わっているので、（重複しうるハッシュ方式でも）このゴールデン値では実際に異なる
    expect(dailyQuoteIndex(before, FIXED_LENGTH)).toBe(103);
    expect(dailyQuoteIndex(after, FIXED_LENGTH)).toBe(40);
  });

  it("常に 0 <= index < length（複数日付で検証）", () => {
    const dates = [
      new Date("1999-12-31T00:00:00Z"),
      new Date("2000-01-01T00:00:00Z"),
      new Date("2038-01-19T00:00:00Z"),
      new Date("2100-01-01T00:00:00Z"),
    ];
    for (const d of dates) {
      const idx = dailyQuoteIndex(d, LENGTH);
      expect(Number.isInteger(idx)).toBe(true);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(LENGTH);
    }
  });

  it("1970-01-01以前の日付を渡しても負のインデックスにならない", () => {
    const before1970 = new Date("1969-01-01T00:00:00Z");
    const idx = dailyQuoteIndex(before1970, LENGTH);
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(idx).toBeLessThan(LENGTH);
  });

  it("length <= 0 を渡した場合は例外を投げる（契約固定）", () => {
    expect(() => dailyQuoteIndex(new Date(), 0)).toThrow();
    expect(() => dailyQuoteIndex(new Date(), -1)).toThrow();
  });
});

describe("getDailyQuote", () => {
  it("引数省略時は現在日時・QUOTESを使い、Quoteオブジェクトを返す", () => {
    const quote = getDailyQuote();
    expect(quote).not.toBeNull();
    expect(QUOTES).toContainEqual(quote as Quote);
  });

  it("同一JST日付では常に同じ格言オブジェクトを返す（決定性）", () => {
    const d = new Date("2026-05-05T03:00:00Z");
    const q1 = getDailyQuote(d, QUOTES);
    const q2 = getDailyQuote(new Date(d.getTime()), QUOTES);
    expect(q1).toEqual(q2);
  });

  it("リストが空（length 0）のとき例外を投げずnullを返す", () => {
    expect(() => getDailyQuote(new Date(), [])).not.toThrow();
    expect(getDailyQuote(new Date(), [])).toBeNull();
  });

  it("無効なDate（Invalid Date）を渡した場合、例外を投げずnullを返す", () => {
    const invalid = new Date("not-a-valid-date");
    expect(() => getDailyQuote(invalid, QUOTES)).not.toThrow();
    expect(getDailyQuote(invalid, QUOTES)).toBeNull();
  });
});
