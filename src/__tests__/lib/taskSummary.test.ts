import { describe, it, expect } from "vitest";
import { computeOldestPendingDates, calcCarryOverMissedCount } from "@/lib/taskSummary";

const d = (s: string) => new Date(s);

describe("computeOldestPendingDates", () => {
  it("空入力は空マップを返す", () => {
    expect(computeOldestPendingDates([], [])).toEqual(new Map());
  });

  it("settled が無ければ最古 PENDING がそのまま採用される（templateId 単位で1件）", () => {
    const pending = [
      { templateId: "t1", date: d("2026-05-01") },
      { templateId: "t1", date: d("2026-05-02") },
      { templateId: "t2", date: d("2026-05-03") },
    ];
    const out = computeOldestPendingDates(pending, []);
    expect(out.get("t1")).toEqual(d("2026-05-01"));
    expect(out.get("t2")).toEqual(d("2026-05-03"));
  });

  it("最新 settled より古い PENDING は stale として無視される", () => {
    const pending = [
      { templateId: "t1", date: d("2026-04-30") }, // settled より古い → 無視
      { templateId: "t1", date: d("2026-05-05") }, // settled より新しい → 採用
    ];
    const settled = [
      { templateId: "t1", date: d("2026-05-03") },
    ];
    const out = computeOldestPendingDates(pending, settled);
    expect(out.get("t1")).toEqual(d("2026-05-05"));
  });

  it("最新 settled と同日の PENDING は stale 扱い（境界: <= で除外）", () => {
    const pending = [
      { templateId: "t1", date: d("2026-05-03") },
      { templateId: "t1", date: d("2026-05-04") },
    ];
    const settled = [{ templateId: "t1", date: d("2026-05-03") }];
    const out = computeOldestPendingDates(pending, settled);
    expect(out.get("t1")).toEqual(d("2026-05-04"));
  });

  it("date が null の行は無視される", () => {
    const pending = [
      { templateId: "t1", date: null },
      { templateId: "t1", date: d("2026-05-01") },
    ];
    const out = computeOldestPendingDates(pending, []);
    expect(out.get("t1")).toEqual(d("2026-05-01"));
  });

  it("templateId ごとに settled が独立して評価される", () => {
    const pending = [
      { templateId: "t1", date: d("2026-05-01") },
      { templateId: "t2", date: d("2026-05-01") },
    ];
    const settled = [
      { templateId: "t1", date: d("2026-05-02") }, // t1 のみ stale 化
    ];
    const out = computeOldestPendingDates(pending, settled);
    expect(out.has("t1")).toBe(false);
    expect(out.get("t2")).toEqual(d("2026-05-01"));
  });
});

describe("calcCarryOverMissedCount", () => {
  const today = d("2026-05-08"); // Friday (UTC day=5)

  it("oldestPendingDate が無ければ null", () => {
    expect(calcCarryOverMissedCount(null, today, [1, 3, 5])).toBeNull();
    expect(calcCarryOverMissedCount(undefined, today, [1, 3, 5])).toBeNull();
  });

  it("repeatDays が空なら 1 にフォールバック（isTemporary 想定）", () => {
    expect(calcCarryOverMissedCount(d("2026-05-01"), today, [])).toBe(1);
  });

  it("repeatDays が指定されていれば countScheduledOccurrences の結果を返す", () => {
    // 2026-05-04 (Mon=1) から 2026-05-08 (Fri=5) まで、月・水・金 = 3回
    expect(calcCarryOverMissedCount(d("2026-05-04"), today, [1, 3, 5])).toBe(3);
  });

  it("oldestPendingDate === today（同日）も inclusive で 1 回以上", () => {
    // 2026-05-08 (Fri=5) のみ、金曜なら 1 回
    expect(calcCarryOverMissedCount(today, today, [5])).toBe(1);
    // 該当曜日でなければ 0
    expect(calcCarryOverMissedCount(today, today, [1])).toBe(0);
  });
});
