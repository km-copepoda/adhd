import { describe, expect, it } from "vitest";
import { isTaskStreakActive, previousScheduledDate } from "@/lib/date";

describe("previousScheduledDate", () => {
  // 2026-04-26 = Sunday(0)
  // 2026-04-27 = Monday(1)
  // 2026-04-28 = Tuesday(2)
  // 2026-04-29 = Wednesday(3)
  // 2026-04-30 = Thursday(4)
  // 2026-05-01 = Friday(5)
  // 2026-05-02 = Saturday(6)

  function dateUTC(s: string): Date {
    return new Date(s + "T00:00:00Z");
  }

  it("repeatDays が空配列なら null", () => {
    expect(previousScheduledDate([], dateUTC("2026-04-29"))).toBeNull();
  });

  it("毎日 [0..6] なら昨日", () => {
    const r = previousScheduledDate([0, 1, 2, 3, 4, 5, 6], dateUTC("2026-04-29"));
    expect(r?.toISOString().slice(0, 10)).toBe("2026-04-28");
  });

  it("月水金 [1,3,5]: 水曜日 → 直前は月曜", () => {
    const r = previousScheduledDate([1, 3, 5], dateUTC("2026-04-29")); // Wed
    expect(r?.toISOString().slice(0, 10)).toBe("2026-04-27"); // Mon
  });

  it("月水金 [1,3,5]: 土曜日 → 直前は金曜", () => {
    const r = previousScheduledDate([1, 3, 5], dateUTC("2026-05-02")); // Sat
    expect(r?.toISOString().slice(0, 10)).toBe("2026-05-01"); // Fri
  });

  it("月水金 [1,3,5]: 日曜日 → 直前は金曜", () => {
    const r = previousScheduledDate([1, 3, 5], dateUTC("2026-05-03")); // Sun
    expect(r?.toISOString().slice(0, 10)).toBe("2026-05-01"); // Fri
  });

  it("月水金 [1,3,5]: 月曜日 → 直前は先週金曜", () => {
    const r = previousScheduledDate([1, 3, 5], dateUTC("2026-05-04")); // Mon
    expect(r?.toISOString().slice(0, 10)).toBe("2026-05-01"); // Fri prev
  });

  it("単一曜日 [3] のみ: 水曜 → 直前は先週水曜（7日前）", () => {
    const r = previousScheduledDate([3], dateUTC("2026-04-29")); // Wed
    expect(r?.toISOString().slice(0, 10)).toBe("2026-04-22"); // Wed last week
  });

  it("today より厳密に過去の日付を返す（today自身は含まない）", () => {
    const r = previousScheduledDate([1, 3, 5], dateUTC("2026-04-29")); // Wed in repeatDays
    expect(r?.toISOString().slice(0, 10)).toBe("2026-04-27"); // not today
  });
});

describe("isTaskStreakActive (repeatDays aware)", () => {
  const REPEAT_DAILY = [0, 1, 2, 3, 4, 5, 6];
  const REPEAT_MWF = [1, 3, 5];

  it("null なら false", () => {
    expect(isTaskStreakActive(REPEAT_DAILY, null, "2026-04-29")).toBe(false);
  });

  it("repeatDays 空なら false（recurrence なし）", () => {
    expect(isTaskStreakActive([], "2026-04-28", "2026-04-29")).toBe(false);
  });

  it("毎日: 今日完了なら true", () => {
    expect(isTaskStreakActive(REPEAT_DAILY, "2026-04-29", "2026-04-29")).toBe(true);
  });

  it("毎日: 昨日完了なら true", () => {
    expect(isTaskStreakActive(REPEAT_DAILY, "2026-04-28", "2026-04-29")).toBe(true);
  });

  it("毎日: 2日前なら false", () => {
    expect(isTaskStreakActive(REPEAT_DAILY, "2026-04-27", "2026-04-29")).toBe(false);
  });

  it("月水金: 金曜完了 → 土曜は active", () => {
    // last=Fri 2026-05-01, today=Sat 2026-05-02, prev sched=Fri → active
    expect(isTaskStreakActive(REPEAT_MWF, "2026-05-01", "2026-05-02")).toBe(true);
  });

  it("月水金: 金曜完了 → 日曜も active", () => {
    expect(isTaskStreakActive(REPEAT_MWF, "2026-05-01", "2026-05-03")).toBe(true);
  });

  it("月水金: 金曜完了 → 月曜（次の予定日）も active（まだ実行猶予あり）", () => {
    // today=Mon 2026-05-04 (scheduled), prev sched=Fri 2026-05-01
    // last=Fri >= prev → active
    expect(isTaskStreakActive(REPEAT_MWF, "2026-05-01", "2026-05-04")).toBe(true);
  });

  it("月水金: 月曜を逃して火曜になったら streak 切れ（last=先週金曜）", () => {
    // today=Tue 2026-05-05, prev sched=Mon 2026-05-04
    // last=Fri 2026-05-01 < Mon → inactive
    expect(isTaskStreakActive(REPEAT_MWF, "2026-05-01", "2026-05-05")).toBe(false);
  });

  it("月水金: 月曜完了 → 火曜は active", () => {
    expect(isTaskStreakActive(REPEAT_MWF, "2026-05-04", "2026-05-05")).toBe(true);
  });

  it("月水金: 今日が予定日(水曜) かつ 今日完了 → active", () => {
    expect(isTaskStreakActive(REPEAT_MWF, "2026-04-29", "2026-04-29")).toBe(true);
  });

  it("月水金: 今日が予定日(水曜) かつ 直前の予定日(月)を逃した → inactive", () => {
    // last=Fri last week (2026-04-24), today=Wed 2026-04-29, prev sched=Mon 2026-04-27
    expect(isTaskStreakActive(REPEAT_MWF, "2026-04-24", "2026-04-29")).toBe(false);
  });

  it("@db.Date 形式（T00:00:00.000Z サフィックス付き）でも正しく判定", () => {
    expect(isTaskStreakActive(REPEAT_DAILY, "2026-04-28T00:00:00.000Z", "2026-04-29")).toBe(true);
    expect(isTaskStreakActive(REPEAT_DAILY, "2026-04-27T00:00:00.000Z", "2026-04-29")).toBe(false);
  });
});
