import { describe, it, expect } from "vitest";
import { dailyQuoteIndex, getDailyQuote } from "@/lib/quotes";
import { QUOTES } from "@/lib/quotes.data";
import type { Quote } from "@/lib/quotes.data";

const LENGTH = QUOTES.length;

describe("dailyQuoteIndex", () => {
  it("同一JST日付を複数回渡すと常に同じインデックスを返す（決定性）", () => {
    const d = new Date("2026-03-10T03:00:00Z"); // JST 3/10 12:00
    const i1 = dailyQuoteIndex(d, LENGTH);
    const i2 = dailyQuoteIndex(new Date(d.getTime()), LENGTH);
    expect(i1).toBe(i2);
  });

  it("連続する2日で+1進む（周回しない場合）", () => {
    // LENGTH件のリストで、周回しない適当な起点を選ぶ（エポック日数 % LENGTH が LENGTH-1 でない日）
    let day = new Date("2026-03-10T03:00:00Z");
    let next = new Date(day.getTime() + 24 * 60 * 60 * 1000);
    // 周回する場合は基準日をずらして再試行
    while (dailyQuoteIndex(day, LENGTH) === LENGTH - 1) {
      day = new Date(day.getTime() + 24 * 60 * 60 * 1000);
      next = new Date(day.getTime() + 24 * 60 * 60 * 1000);
    }
    expect(dailyQuoteIndex(next, LENGTH)).toBe(dailyQuoteIndex(day, LENGTH) + 1);
  });

  it("JST日付境界: 23:59と翌0:00で異なるインデックスになりうる（日付が変わる）", () => {
    const before = new Date("2026-01-01T14:59:59Z"); // JST 1/1 23:59:59
    const after = new Date("2026-01-01T15:00:00Z"); // JST 1/2 00:00:00
    // 日付そのものが変わったことを確認する意味で、それぞれの元日数を比較する
    const beforeIndex = dailyQuoteIndex(before, LENGTH);
    const afterIndex = dailyQuoteIndex(after, LENGTH);
    // 日付が進んでいるので、周回しない限りインデックスも進む
    const beforeEpochDay = Math.floor(
      (before.getTime() + 9 * 60 * 60 * 1000) / 86400000,
    );
    const afterEpochDay = Math.floor(
      (after.getTime() + 9 * 60 * 60 * 1000) / 86400000,
    );
    expect(afterEpochDay).toBe(beforeEpochDay + 1);
    expect(afterIndex).toBe((beforeIndex + 1) % LENGTH);
  });

  it("年またぎでローテーションがリセットされず連続して進む", () => {
    const dec31 = new Date("2025-12-31T03:00:00Z"); // JST 12/31 12:00
    const jan1 = new Date("2026-01-01T03:00:00Z"); // JST 1/1 12:00
    const i1 = dailyQuoteIndex(dec31, LENGTH);
    const i2 = dailyQuoteIndex(jan1, LENGTH);
    expect(i2).toBe((i1 + 1) % LENGTH);
  });

  it("うるう年の2/28→2/29→3/1が連続して1ずつ進む", () => {
    const feb28 = new Date("2028-02-28T03:00:00Z");
    const feb29 = new Date("2028-02-29T03:00:00Z");
    const mar1 = new Date("2028-03-01T03:00:00Z");
    const i28 = dailyQuoteIndex(feb28, LENGTH);
    const i29 = dailyQuoteIndex(feb29, LENGTH);
    const i1 = dailyQuoteIndex(mar1, LENGTH);
    expect(i29).toBe((i28 + 1) % LENGTH);
    expect(i1).toBe((i29 + 1) % LENGTH);
  });

  it("剰余0の境界: 一周して0に戻る日でも 0 <= index < length の範囲内", () => {
    // 176日分連続して確認し、必ず一度は0に戻ることと、常に範囲内であることを検証する
    const base = new Date("2026-01-01T03:00:00Z");
    const indices: number[] = [];
    for (let i = 0; i < LENGTH; i++) {
      const d = new Date(base.getTime() + i * 24 * 60 * 60 * 1000);
      const idx = dailyQuoteIndex(d, LENGTH);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(LENGTH);
      indices.push(idx);
    }
    expect(new Set(indices).size).toBe(LENGTH);
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
