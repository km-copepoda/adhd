import { describe, it, expect } from "vitest";
import {
  computeOldestPendingDates,
  calcCarryOverMissedCount,
  computeLastSkippedDates,
} from "@/lib/taskSummary";

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

  it("repeatDays が空（isTemporary+carryOver 想定）なら oldestPendingDate から today までの経過日数(inclusive)", () => {
    // 2026-05-01 から 2026-05-08 まで inclusive = 8 日 (何日持ち越したかを親バッジに反映)
    expect(calcCarryOverMissedCount(d("2026-05-01"), today, [])).toBe(8);
  });

  it("repeatDays が空で oldestPendingDate === today なら 1 (今日出現したばかりの一時タスク)", () => {
    expect(calcCarryOverMissedCount(today, today, [])).toBe(1);
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

describe("computeLastSkippedDates", () => {
  it("空入力は空マップを返す", () => {
    expect(computeLastSkippedDates([], [])).toEqual(new Map());
  });

  it("APPROVED が無ければ最新 SKIPPED がそのまま採用される（templateId 単位で1件）", () => {
    const skipped = [
      { templateId: "t1", date: d("2026-05-05") },
      { templateId: "t1", date: d("2026-05-03") },
      { templateId: "t2", date: d("2026-05-04") },
    ];
    const out = computeLastSkippedDates(skipped, []);
    expect(out.get("t1")).toEqual(d("2026-05-05"));
    expect(out.get("t2")).toEqual(d("2026-05-04"));
  });

  it("SKIPPED より新しい APPROVED が存在する場合、バッジを消す（その templateId をマップから除外）", () => {
    const skipped = [{ templateId: "t1", date: d("2026-05-03") }];
    const approved = [{ templateId: "t1", date: d("2026-05-05") }];
    const out = computeLastSkippedDates(skipped, approved);
    expect(out.has("t1")).toBe(false);
  });

  it("APPROVED が SKIPPED より古ければバッジは残る", () => {
    const skipped = [{ templateId: "t1", date: d("2026-05-05") }];
    const approved = [{ templateId: "t1", date: d("2026-05-03") }];
    const out = computeLastSkippedDates(skipped, approved);
    expect(out.get("t1")).toEqual(d("2026-05-05"));
  });

  it("APPROVED と SKIPPED が同日でもバッジは残る（DB unique 制約で起きないが防御的に keep）", () => {
    const skipped = [{ templateId: "t1", date: d("2026-05-05") }];
    const approved = [{ templateId: "t1", date: d("2026-05-05") }];
    const out = computeLastSkippedDates(skipped, approved);
    expect(out.get("t1")).toEqual(d("2026-05-05"));
  });

  it("templateId ごとに独立評価される（t1 はクリア、t2 は残る）", () => {
    const skipped = [
      { templateId: "t1", date: d("2026-05-03") },
      { templateId: "t2", date: d("2026-05-04") },
    ];
    const approved = [
      { templateId: "t1", date: d("2026-05-05") }, // t1 はクリア
      // t2 は APPROVED 無し
    ];
    const out = computeLastSkippedDates(skipped, approved);
    expect(out.has("t1")).toBe(false);
    expect(out.get("t2")).toEqual(d("2026-05-04"));
  });

  it("date が null の SKIPPED 行は無視される", () => {
    const skipped = [
      { templateId: "t1", date: null },
      { templateId: "t1", date: d("2026-05-03") },
    ];
    const out = computeLastSkippedDates(skipped, []);
    expect(out.get("t1")).toEqual(d("2026-05-03"));
  });

  it("date が null の APPROVED 行は比較に使われない", () => {
    const skipped = [{ templateId: "t1", date: d("2026-05-03") }];
    const approved = [{ templateId: "t1", date: null }];
    const out = computeLastSkippedDates(skipped, approved);
    expect(out.get("t1")).toEqual(d("2026-05-03"));
  });

  it("複数の APPROVED があれば最新の APPROVED が SKIPPED より新しいかで判定する", () => {
    const skipped = [{ templateId: "t1", date: d("2026-05-05") }];
    const approved = [
      { templateId: "t1", date: d("2026-05-07") }, // 最新（採用される）
      { templateId: "t1", date: d("2026-05-02") }, // 古い
    ];
    const out = computeLastSkippedDates(skipped, approved);
    expect(out.has("t1")).toBe(false);
  });
});
