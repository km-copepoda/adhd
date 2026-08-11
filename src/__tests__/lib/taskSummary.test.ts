import { describe, it, expect } from "vitest";
import {
  computeOldestPendingDates,
  calcCarryOverMissedCount,
  computeLastSkippedDates,
  totalPausedDaysInRange,
  effectiveIntervalsFor,
  activeDaysBetween,
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

  it("停止中は「現在停止区間」を effectiveIntervalsFor で含めれば count が凍結される (repeatDays 空)", () => {
    // 5/1 持ち越し, pausedAt=5/4 (以降 today=5/8 まで停止中)
    // 現在停止区間 [5/4, 5/8] を含めると 5/1..5/3 の 3 日だけ残るが、
    // Math.max(1, ...) は使わない(停止分ぶんは差し引きたい)。
    // spec: pausedAt 側で凍結 = 「5/4 に到達したのが直近の 4 日目」
    // 実装は effectiveIntervalsFor + calcCarryOverMissedCount(today=実今日) で表現
    const pausedAt = d("2026-05-04");
    const intervals = effectiveIntervalsFor([], pausedAt, today);
    // 5/1..5/8 の 8 日から停止 5/4..5/8 の 5 日を除外 → 3 日
    expect(calcCarryOverMissedCount(d("2026-05-01"), today, [], intervals)).toBe(3);
  });

  it("停止期間中の repeatDays 出現は除外される", () => {
    // 5/1 (Fri) 〜 5/8 (Fri) の月水金: 5/1 Fri, 5/4 Mon, 5/6 Wed, 5/8 Fri = 4回
    // 停止期間 5/4-5/7 の中の月(5/4)・水(5/6) を除外 → 5/1 Fri, 5/8 Fri = 2 回
    const intervals = [{ start: d("2026-05-04"), end: d("2026-05-07") }];
    expect(
      calcCarryOverMissedCount(d("2026-05-01"), today, [1, 3, 5], intervals),
    ).toBe(2);
  });

  it("停止期間が repeatDays を含まない場合はカウントに影響しない", () => {
    // repeatDays=[1] (月のみ)、停止 5/2 (Sat) 〜 5/3 (Sun) は月曜を含まない
    // 5/4 (Mon) のみ → 1 回
    const intervals = [{ start: d("2026-05-02"), end: d("2026-05-03") }];
    expect(
      calcCarryOverMissedCount(d("2026-05-01"), today, [1], intervals),
    ).toBe(1);
  });

  it("repeatDays 空 (一時タスク) は停止期間ぶんの日数を差し引く", () => {
    // 5/1〜5/8 inclusive = 8 日、停止 5/3〜5/5 (3 日) を差し引く → 5 日
    const intervals = [{ start: d("2026-05-03"), end: d("2026-05-05") }];
    expect(
      calcCarryOverMissedCount(d("2026-05-01"), today, [], intervals),
    ).toBe(5);
  });

  it("停止期間が oldest 以前 / today 以降にはみ出しても範囲内のみ差し引く", () => {
    // oldest=5/3, today=5/8, intervals=[4/29〜5/4, 5/7〜5/12]
    // 範囲 [5/3, 5/8] の内、5/3, 5/4 (前半停止), 5/7, 5/8 (後半停止) の 4 日が停止
    // 5/5, 5/6 が非停止 → 2 日
    const intervals = [
      { start: d("2026-04-29"), end: d("2026-05-04") },
      { start: d("2026-05-07"), end: d("2026-05-12") },
    ];
    expect(
      calcCarryOverMissedCount(d("2026-05-03"), today, [], intervals),
    ).toBe(2);
  });
});

describe("effectiveIntervalsFor", () => {
  const today = d("2026-05-20");

  it("停止していない場合は既存の配列をそのまま返す", () => {
    const past = [{ start: d("2026-05-01"), end: d("2026-05-03") }];
    expect(effectiveIntervalsFor(past, null, today)).toEqual(past);
  });

  it("停止中なら [pausedAt, today] を追加する（凍結を今日まで延長）", () => {
    const pausedAt = d("2026-05-15");
    const past = [{ start: d("2026-05-01"), end: d("2026-05-03") }];
    expect(effectiveIntervalsFor(past, pausedAt, today)).toEqual([
      ...past,
      { start: pausedAt, end: today },
    ]);
  });

  it("intervals 空でも停止中なら 1 件返す", () => {
    const pausedAt = d("2026-05-15");
    expect(effectiveIntervalsFor([], pausedAt, today)).toEqual([
      { start: pausedAt, end: today },
    ]);
  });
});

describe("activeDaysBetween", () => {
  it("停止なし: 単純な JST 日数差", () => {
    // 5/1..5/5 = 4 日 (「4日前」の意味)
    expect(activeDaysBetween(d("2026-05-01"), d("2026-05-05"), [])).toBe(4);
  });

  it("同日は 0 日", () => {
    expect(activeDaysBetween(d("2026-05-05"), d("2026-05-05"), [])).toBe(0);
  });

  it("停止期間ぶんを差し引いて active 経過日数を返す", () => {
    // 5/1..5/10 = 9 日、停止 5/3..5/6 (4 日) を除外 → 5 日
    const intervals = [{ start: d("2026-05-03"), end: d("2026-05-06") }];
    expect(activeDaysBetween(d("2026-05-01"), d("2026-05-10"), intervals)).toBe(5);
  });

  it("from が to より未来の場合は 0", () => {
    expect(activeDaysBetween(d("2026-05-10"), d("2026-05-05"), [])).toBe(0);
  });

  it("複数区間を合算して除外", () => {
    // 5/1..5/20 = 19 日、停止 5/3..5/4 (2 日) + 5/10..5/12 (3 日) → 14 日
    const intervals = [
      { start: d("2026-05-03"), end: d("2026-05-04") },
      { start: d("2026-05-10"), end: d("2026-05-12") },
    ];
    expect(activeDaysBetween(d("2026-05-01"), d("2026-05-20"), intervals)).toBe(14);
  });
});

describe("totalPausedDaysInRange", () => {
  it("intervals が空なら 0", () => {
    expect(totalPausedDaysInRange(d("2026-05-01"), d("2026-05-10"), [])).toBe(0);
  });

  it("interval が範囲内に完全包含される場合は inclusive 日数", () => {
    // 5/3〜5/5 = 3 日
    const intervals = [{ start: d("2026-05-03"), end: d("2026-05-05") }];
    expect(totalPausedDaysInRange(d("2026-05-01"), d("2026-05-10"), intervals)).toBe(3);
  });

  it("interval が範囲を跨ぐ場合は範囲内部分のみを日数化", () => {
    // interval 4/25〜5/2 と 範囲 5/1〜5/5 の overlap は 5/1〜5/2 = 2 日
    const intervals = [{ start: d("2026-04-25"), end: d("2026-05-02") }];
    expect(totalPausedDaysInRange(d("2026-05-01"), d("2026-05-05"), intervals)).toBe(2);
  });

  it("複数 intervals をすべて合算する (重複なし想定)", () => {
    const intervals = [
      { start: d("2026-05-02"), end: d("2026-05-03") }, // 2 日
      { start: d("2026-05-06"), end: d("2026-05-07") }, // 2 日
    ];
    expect(totalPausedDaysInRange(d("2026-05-01"), d("2026-05-10"), intervals)).toBe(4);
  });

  it("JST 日単位で重なる境界日は 1 度だけ数える（同日再開→再停止など）", () => {
    // [8/1, 8/2] と [8/2, 8/2] の和集合日は 8/1, 8/2 の 2 日
    const intervals = [
      { start: d("2026-08-01"), end: d("2026-08-02") },
      { start: d("2026-08-02"), end: d("2026-08-02") },
    ];
    expect(totalPausedDaysInRange(d("2026-08-01"), d("2026-08-10"), intervals)).toBe(2);
  });

  it("完全に内包される区間は追加日を数えない", () => {
    // [8/1, 8/5] が [8/2, 8/3] を内包 → 和集合日は 5
    const intervals = [
      { start: d("2026-08-01"), end: d("2026-08-05") },
      { start: d("2026-08-02"), end: d("2026-08-03") },
    ];
    expect(totalPausedDaysInRange(d("2026-08-01"), d("2026-08-10"), intervals)).toBe(5);
  });

  it("順不同でも正しく union する", () => {
    // [8/5, 8/6] と [8/1, 8/2] → 合計 4 日
    const intervals = [
      { start: d("2026-08-05"), end: d("2026-08-06") },
      { start: d("2026-08-01"), end: d("2026-08-02") },
    ];
    expect(totalPausedDaysInRange(d("2026-08-01"), d("2026-08-10"), intervals)).toBe(4);
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
