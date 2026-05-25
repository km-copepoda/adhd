import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { todayJST, dayOfWeekJST, monthStartJST, monthEndJST, todayRangeJST, isVisibleTemporaryTask, formatReportedTime, countScheduledOccurrences } from "@/lib/date";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("todayJST", () => {
  it("JST午後（UTCと同じ日付）の場合、正しい日付を返すこと", () => {
    // JST 2026-03-12 15:00 = UTC 2026-03-12 06:00
    vi.setSystemTime(new Date("2026-03-12T06:00:00Z"));
    expect(todayJST()).toEqual(new Date("2026-03-12T00:00:00Z"));
  });
  
  it("JST深夜（UTCはまだ前日）の場合、JST基準の日付を返すこと", () => {
    // JST 2026-03-12 01:00 = UTC 2026-03-11 16:00
    vi.setSystemTime(new Date("2026-03-11T16:00:00Z"));
    expect(todayJST()).toEqual(new Date("2026-03-12T00:00:00Z"));
  });
  
  it("JST 0:00ちょうど（UTC 15:00前日）の場合、正しい日付を返すこと", () => {
    // JST 2026-03-12 00:00 = UTC 2026-03-11 15:00
    vi.setSystemTime(new Date("2026-03-11T15:00:00Z"));
    expect(todayJST()).toEqual(new Date("2026-03-12T00:00:00Z"));
  });

  it("JST 23:59（UTC 14:59前日）の場合、まだ同じ日付を返すこと", () => {
    // JST 2026-03-12 23:59 = UTC 2026-03-12 14:59
    vi.setSystemTime(new Date("2026-03-12T14:59:00Z"));
    expect(todayJST()).toEqual(new Date("2026-03-12T00:00:00Z"));
  });
  
  it("UTC 15:00（JST翌日0:00）で日付が切り替わること", () => {
    // UTC 2026-03-12 14:59 -> JST 2026-03-12 23:59
    vi.setSystemTime(new Date("2026-03-12T14:59:00Z"));
    expect(todayJST()).toEqual(new Date("2026-03-12T00:00:00Z"));
    
    // UTC 2026-03-12 15:00 -> JST 2026-03-13 00:00
    vi.setSystemTime(new Date("2026-03-12T15:00:00Z"));
    expect(todayJST()).toEqual(new Date("2026-03-13T00:00:00Z"));
  });
});

describe("dayOfWeekJST", () => {
  it("JST基準の曜日を返すこと", () => {
    // JST 2026-03-12（木曜=4）01:00 = UTC 2026-03-11（水曜=3）16:00
    vi.setSystemTime(new Date("2026-03-11T16:00:00Z"));
    expect(dayOfWeekJST()).toBe(4); // 木曜
  });
  
  it("UTCの曜日と異なる場合にJSTの曜日を返すこと", () => {
    // JST 2026-03-15（日曜=0）02:00 = UTC 2026-03-14（土曜=6）17:00
    vi.setSystemTime(new Date("2026-03-14T17:00:00Z"));
    expect(dayOfWeekJST()).toBe(0); // 日曜
  });
});

describe("monthStartJST / monthEndJST", () => {
  it("月初を正しく返すこと", () => {
    vi.setSystemTime(new Date("2026-03-15T06:00:00Z"));
    expect(monthStartJST()).toEqual(new Date("2026-03-01T00:00:00Z"));
  });
  
  it("月末を正しく返すこと", () => {
    vi.setSystemTime(new Date("2026-03-15T06:00:00Z"));
    expect(monthEndJST()).toEqual(new Date("2026-03-31T00:00:00Z"))
  });
  
  it("月またぎ境界（JST 4/1 0:00 = UTC 3/31 15:00）で翌月を返すこと", () => {
    // JST 2026-04-01 00:00 = UTC 2026-03-31 15:00
    vi.setSystemTime(new Date("2026-03-31T15:00:00Z"));
    expect(monthStartJST()).toEqual(new Date("2026-04-01T00:00:00Z"));
    expect(monthEndJST()).toEqual(new Date("2026-04-30T00:00:00Z"));
  });
  
  it("月またぎ直前（JST 3/31 23:59 = UTC 3/31 14:59）は当月を返すこと", () => {
    vi.setSystemTime(new Date("2026-03-31T14:59:00Z"));
    expect(monthStartJST()).toEqual(new Date("2026-03-01T00:00:00Z"));
    expect(monthEndJST()).toEqual(new Date("2026-03-31T00:00:00Z"));
  });
  
  it("2月末（うるう年ではない2026年）を正しく返すこと", () => {
    vi.setSystemTime(new Date("2026-02-15T06:00:00Z"));
    expect(monthEndJST()).toEqual(new Date("2026-02-28T00:00:00Z"));
  });
});

describe("formatReportedTime", () => {
  const now = new Date("2026-03-22T10:30:00+09:00");
  
  it("1分未満は「たった今」", () => {
    const reported = new Date(now.getTime() - 30 * 1000).toISOString();
    expect(formatReportedTime(reported, now)).toBe("たった今");
  });
  
  it("1分ちょうどは「1分前」", () => {
    const reported = new Date(now.getTime() - 60 * 1000).toISOString();
    expect(formatReportedTime(reported, now)).toBe("1分前");
  });
  
  it("30分前", () => {
    const reported = new Date(now.getTime() - 30 * 60 * 1000).toISOString();
    expect(formatReportedTime(reported, now)).toBe("30分前");
  });
  
  it("59分前", () => {
    const reported = new Date(now.getTime() - 59 * 60 * 1000).toISOString();
    expect(formatReportedTime(reported, now)).toBe("59分前");
  });
  
  it("1時間ちょうどは「1時間前」", () => {
    const reported = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    expect(formatReportedTime(reported, now)).toBe("1時間前");
  });
  
  it("23時間前", () => {
    const reported = new Date(now.getTime() - 23 * 60 * 60 * 1000).toISOString();
    expect(formatReportedTime(reported, now)).toBe("23時間前");
  });
  
  it("24時間以上は絶対日時表示", () => {
    const reported = new Date(now.getTime() - 25 * 60 * 60 * 1000).toISOString();
    const result = formatReportedTime(reported, now);
    // ローカルTZで月/日 時:分 の形式
    expect(result).toMatch(/^\d{1,2}\/\d{1,2} \d{1,2}:\d{2}$/);
  });
});

describe("todayRangeJST", () => {
  it("JST 1日の範囲を返すこと", () => {
    // JST 2026-03-12 の範囲：UTC 2026-03-11T15:00 ～ UTC 2026-03-12T15:00
    vi.setSystemTime(new Date("2026-03-11T16:00:00Z")); // JST 03-12 01:00
    const { start, end } = todayRangeJST();
    expect(start).toEqual(new Date("2026-03-11T15:00:00Z"));
    expect(end).toEqual(new Date("2026-03-12T15:00:00Z"));
  });
  
  it("日付変更直後でも正しいレンジを返すこと", () => {
    // JST 2026-03-12 00:00 = UTC 2026-03-11 15:00
    vi.setSystemTime(new Date("2026-03-11T15:00:00Z"));
    const { start, end } = todayRangeJST();
    expect(start).toEqual(new Date("2026-03-11T15:00:00Z"));
    expect(end).toEqual(new Date("2026-03-12T15:00:00Z"));
  });
});

describe("isVisibleTemporaryTask", () => {
  const today = "2026-03-22";
  const base = { isTemporary: true, createdBy: "PARENT", completedToday: false, targetDate: "2026-03-22" };
  
  it("当日の一時タスクは表示される", () => {
    expect(isVisibleTemporaryTask(base, today)).toBe(true);
  });
  
  it("未来日の一時タスクは表示される", () => {
    expect(isVisibleTemporaryTask({ ...base, targetDate: "2026-03-25" }, today)).toBe(true);
  });
  
  it("期限切れの一時タスクは非表示になる", () => {
    expect(isVisibleTemporaryTask({ ...base, targetDate: "2026-03-21" }, today)).toBe(false);
  });
  
  it("過去日の一時タスクは非表示になる", () => {
    expect(isVisibleTemporaryTask({ ...base, targetDate: "2026-03-01" }, today)).toBe(false);
  });
  
  it("targetDateがnullの一時タスクは表示される", () => {
    expect(isVisibleTemporaryTask({ ...base, targetDate: null }, today)).toBe(true);
  });
  
  it("通常タスク（isTemporary=false）は非表示", () => {
    expect(isVisibleTemporaryTask({ ...base, isTemporary: false }, today)).toBe(false);
  });
  
  it("子供作成タスク（未承認タスク）は非表示", () => {
    expect(isVisibleTemporaryTask({ ...base, createdBy: "CHILD" }, today)).toBe(false);
  });
  
  it("今日完了済みのタスクは非表示", () => {
    expect(isVisibleTemporaryTask({ ...base, completedToday: true }, today)).toBe(false);
  });
});

describe("countScheduledOccurrences", () => {
  // 全ての日付は JST 日付の UTC 0:00 表現（@db.Date と同じ）
  const date = (iso: string) => new Date(iso + "T00:00:00Z");

  it("from === to で repeatDays に該当する曜日なら 1", () => {
    // 2026-03-16 は月曜（UTC dayOfWeek=1）
    expect(countScheduledOccurrences(date("2026-03-16"), date("2026-03-16"), [1])).toBe(1);
  });

  it("from === to で repeatDays に非該当なら 0", () => {
    // 2026-03-17 は火曜（UTC dayOfWeek=2）
    expect(countScheduledOccurrences(date("2026-03-17"), date("2026-03-17"), [1])).toBe(0);
  });

  it("週次タスク（月曜のみ）: 月曜→翌週月曜（7日間 inclusive）は 2 回", () => {
    expect(
      countScheduledOccurrences(date("2026-03-16"), date("2026-03-23"), [1]),
    ).toBe(2);
  });

  it("週次タスク（月曜のみ）: 月曜→次週土曜（6日後）は 1 回", () => {
    expect(
      countScheduledOccurrences(date("2026-03-16"), date("2026-03-21"), [1]),
    ).toBe(1);
  });

  it("週次タスク（月曜のみ）: 月曜→3週後の月曜は 4 回（inclusive 両端）", () => {
    expect(
      countScheduledOccurrences(date("2026-03-16"), date("2026-04-06"), [1]),
    ).toBe(4);
  });

  it("毎日タスク（全曜日）: 3 日間で 3 回", () => {
    expect(
      countScheduledOccurrences(date("2026-03-16"), date("2026-03-18"), [0, 1, 2, 3, 4, 5, 6]),
    ).toBe(3);
  });

  it("平日タスク（月〜金）: 月曜→日曜の7日間は平日5日分", () => {
    expect(
      countScheduledOccurrences(date("2026-03-16"), date("2026-03-22"), [1, 2, 3, 4, 5]),
    ).toBe(5);
  });

  it("from > to なら 0（不正な範囲）", () => {
    expect(
      countScheduledOccurrences(date("2026-03-20"), date("2026-03-16"), [1, 2, 3, 4, 5]),
    ).toBe(0);
  });

  it("repeatDays が空なら 0", () => {
    expect(countScheduledOccurrences(date("2026-03-16"), date("2026-03-22"), [])).toBe(0);
  });

  it("月またぎを正しく数える（3/30 月 → 4/6 月 = 2 回）", () => {
    expect(
      countScheduledOccurrences(date("2026-03-30"), date("2026-04-06"), [1]),
    ).toBe(2);
  });
});

