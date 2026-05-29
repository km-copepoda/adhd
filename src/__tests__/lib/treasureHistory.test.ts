import { describe, it, expect } from "vitest";
import {
  TREASURE_HISTORY_RETENTION_DAYS,
  getTreasureHistoryCutoff,
  formatTreasureOpenedAt,
  isWithinTreasureHistoryWindow,
} from "@/lib/treasureHistory";

describe("TREASURE_HISTORY_RETENTION_DAYS", () => {
  it("7日（1週間）", () => {
    expect(TREASURE_HISTORY_RETENTION_DAYS).toBe(7);
  });
});

describe("getTreasureHistoryCutoff", () => {
  it("now から 7日前 の Date を返す", () => {
    const now = new Date("2026-05-29T10:00:00Z");
    const cutoff = getTreasureHistoryCutoff(now);
    expect(cutoff.getTime()).toBe(new Date("2026-05-22T10:00:00Z").getTime());
  });

  it("月またぎでも 7日前 を返す", () => {
    const now = new Date("2026-06-03T00:00:00Z");
    const cutoff = getTreasureHistoryCutoff(now);
    expect(cutoff.toISOString()).toBe("2026-05-27T00:00:00.000Z");
  });
});

describe("isWithinTreasureHistoryWindow", () => {
  const now = new Date("2026-05-29T10:00:00Z");

  it("now と同じ瞬間は含む", () => {
    expect(isWithinTreasureHistoryWindow(now, now)).toBe(true);
  });

  it("1日前は含む", () => {
    const openedAt = new Date("2026-05-28T10:00:00Z");
    expect(isWithinTreasureHistoryWindow(openedAt, now)).toBe(true);
  });

  it("ちょうど 7日前 は含む（境界値）", () => {
    const openedAt = new Date("2026-05-22T10:00:00Z");
    expect(isWithinTreasureHistoryWindow(openedAt, now)).toBe(true);
  });

  it("7日前より 1ミリ秒古いものは含まない（境界値）", () => {
    const openedAt = new Date("2026-05-22T09:59:59.999Z");
    expect(isWithinTreasureHistoryWindow(openedAt, now)).toBe(false);
  });

  it("8日前は含まない", () => {
    const openedAt = new Date("2026-05-21T10:00:00Z");
    expect(isWithinTreasureHistoryWindow(openedAt, now)).toBe(false);
  });

  it("openedAt が null なら false", () => {
    expect(isWithinTreasureHistoryWindow(null, now)).toBe(false);
  });
});

describe("formatTreasureOpenedAt", () => {
  it("JST で 月/日 HH:mm を返す", () => {
    // 2026-05-29T09:30:00Z = JST 18:30
    const iso = "2026-05-29T09:30:00Z";
    expect(formatTreasureOpenedAt(iso)).toBe("5/29 18:30");
  });

  it("0時台は 1桁時間で表示し分はゼロ埋め", () => {
    // JST 00:05 = UTC 前日 15:05
    const iso = "2026-05-28T15:05:00Z";
    expect(formatTreasureOpenedAt(iso)).toBe("5/29 0:05");
  });

  it("夜の日付境界（UTC→JST跨ぎ）でも JST 日付になる", () => {
    // UTC 2026-05-29T23:30 = JST 2026-05-30T08:30
    const iso = "2026-05-29T23:30:00Z";
    expect(formatTreasureOpenedAt(iso)).toBe("5/30 8:30");
  });

  it("null/undefined/空文字は空文字を返す", () => {
    expect(formatTreasureOpenedAt(null)).toBe("");
    expect(formatTreasureOpenedAt(undefined)).toBe("");
    expect(formatTreasureOpenedAt("")).toBe("");
  });
});
