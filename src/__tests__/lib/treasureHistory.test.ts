import { describe, it, expect } from "vitest";
import {
  TREASURE_HISTORY_RETENTION_DAYS,
  getTreasureHistoryCutoff,
  formatTreasureOpenedAt,
  isWithinTreasureHistoryWindow,
} from "@/lib/treasureHistory";

describe("TREASURE_HISTORY_RETENTION_DAYS", () => {
  it("30日（1か月固定・#72 で 7日 から変更）", () => {
    expect(TREASURE_HISTORY_RETENTION_DAYS).toBe(30);
  });
});

describe("getTreasureHistoryCutoff", () => {
  it("now から 30日前 の Date を返す", () => {
    const now = new Date("2026-05-29T10:00:00Z");
    const cutoff = getTreasureHistoryCutoff(now);
    expect(cutoff.getTime()).toBe(new Date("2026-04-29T10:00:00Z").getTime());
  });

  it("月またぎでも 30日前 を返す", () => {
    const now = new Date("2026-06-03T00:00:00Z");
    const cutoff = getTreasureHistoryCutoff(now);
    expect(cutoff.toISOString()).toBe("2026-05-04T00:00:00.000Z");
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

  it("ちょうど 30日前 は含む（境界値・inclusive）", () => {
    const openedAt = new Date("2026-04-29T10:00:00Z");
    expect(isWithinTreasureHistoryWindow(openedAt, now)).toBe(true);
  });

  it("30日前より 1ミリ秒古いものは含まない（境界値）", () => {
    const openedAt = new Date("2026-04-29T09:59:59.999Z");
    expect(isWithinTreasureHistoryWindow(openedAt, now)).toBe(false);
  });

  it("31日前は含まない", () => {
    const openedAt = new Date("2026-04-28T10:00:00Z");
    expect(isWithinTreasureHistoryWindow(openedAt, now)).toBe(false);
  });

  it("openedAt が null なら false", () => {
    expect(isWithinTreasureHistoryWindow(null, now)).toBe(false);
  });

  it("openedAt が undefined なら false", () => {
    expect(isWithinTreasureHistoryWindow(undefined, now)).toBe(false);
  });

  it("未来日時（サーバ/端末の時計ズレ）は含む", () => {
    const openedAt = new Date("2026-05-30T10:00:00Z");
    expect(isWithinTreasureHistoryWindow(openedAt, now)).toBe(true);
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
