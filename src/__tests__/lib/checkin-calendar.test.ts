import { describe, it, expect } from "vitest";
import { buildWeekStrip, buildMonthGrid } from "@/lib/checkin.calendar";

describe("buildWeekStrip", () => {
  it("既定 7 日、右端が今日・左端が 6 日前", () => {
    const cells = buildWeekStrip({
      todayStr: "2026-06-25",
      logs: [],
      deadline: "16:00",
      now: new Date("2026-06-25T06:30:00Z"), // JST 15:30
    });
    expect(cells).toHaveLength(7);
    expect(cells[0].date).toBe("2026-06-19");
    expect(cells[6].date).toBe("2026-06-25");
  });

  it("days を指定すると日数を変えられる", () => {
    const cells = buildWeekStrip({
      todayStr: "2026-06-25",
      days: 3,
      logs: [],
      deadline: "16:00",
      now: new Date("2026-06-25T06:30:00Z"),
    });
    expect(cells.map((c) => c.date)).toEqual([
      "2026-06-23",
      "2026-06-24",
      "2026-06-25",
    ]);
  });

  it("weekday は JS Date.getUTCDay() 準拠 (日=0..土=6)", () => {
    // 2026-06-25 は木曜 → weekday=4
    const cells = buildWeekStrip({
      todayStr: "2026-06-25",
      logs: [],
      deadline: "16:00",
      now: new Date("2026-06-25T06:30:00Z"),
    });
    expect(cells[6].weekday).toBe(4); // 木
    expect(cells[5].weekday).toBe(3); // 水
    expect(cells[0].weekday).toBe(5); // 金（6/19）
  });

  it("成功ログは success、失敗ログは fail", () => {
    const cells = buildWeekStrip({
      todayStr: "2026-06-25",
      logs: [
        { date: "2026-06-23", success: true },
        { date: "2026-06-24", success: false },
      ],
      deadline: "16:00",
      now: new Date("2026-06-25T06:30:00Z"),
    });
    const byDate = new Map(cells.map((c) => [c.date, c]));
    expect(byDate.get("2026-06-23")!.state).toBe("success");
    expect(byDate.get("2026-06-24")!.state).toBe("fail");
  });

  it("過去日でログなし＆enabledSince 未指定なら fail", () => {
    const cells = buildWeekStrip({
      todayStr: "2026-06-25",
      logs: [],
      deadline: "16:00",
      now: new Date("2026-06-25T06:30:00Z"),
    });
    expect(cells[0].state).toBe("fail"); // 6/19
    expect(cells[5].state).toBe("fail"); // 6/24
  });

  it("enabledSince より前の日はログ無しなら empty（'-' 表示用）", () => {
    const cells = buildWeekStrip({
      todayStr: "2026-06-25",
      logs: [],
      deadline: "16:00",
      enabledSince: "2026-06-24",
      now: new Date("2026-06-25T06:30:00Z"),
    });
    const byDate = new Map(cells.map((c) => [c.date, c]));
    expect(byDate.get("2026-06-19")!.state).toBe("empty");
    expect(byDate.get("2026-06-23")!.state).toBe("empty");
    expect(byDate.get("2026-06-24")!.state).toBe("fail"); // 当日からは判定対象
  });

  it("enabledSince より前は empty を優先（リリース前にログは存在しない前提）", () => {
    const cells = buildWeekStrip({
      todayStr: "2026-06-25",
      logs: [{ date: "2026-06-20", success: true }],
      deadline: "16:00",
      enabledSince: "2026-06-24",
      now: new Date("2026-06-25T06:30:00Z"),
    });
    const byDate = new Map(cells.map((c) => [c.date, c]));
    expect(byDate.get("2026-06-20")!.state).toBe("empty");
  });

  it("今日が締切前で未チェックイン → today", () => {
    const cells = buildWeekStrip({
      todayStr: "2026-06-25",
      logs: [],
      deadline: "16:00",
      now: new Date("2026-06-25T06:30:00Z"), // JST 15:30
    });
    expect(cells[6].state).toBe("today");
  });

  it("今日が締切後で未チェックイン → fail", () => {
    const cells = buildWeekStrip({
      todayStr: "2026-06-25",
      logs: [],
      deadline: "16:00",
      now: new Date("2026-06-25T08:00:00Z"), // JST 17:00
    });
    expect(cells[6].state).toBe("fail");
  });
});

describe("buildMonthGrid", () => {
  it("月の日数分だけセルを返す（6月=30日）", () => {
    const cells = buildMonthGrid({
      year: 2026,
      month: 6,
      logs: [],
      todayStr: "2026-06-25",
      deadline: "16:00",
      now: new Date("2026-06-25T06:30:00Z"),
    });
    expect(cells).toHaveLength(30);
    expect(cells[0].date).toBe("2026-06-01");
    expect(cells[29].date).toBe("2026-06-30");
  });

  it("2月は 28 or 29 日（うるう年 2028 → 29 日）", () => {
    expect(
      buildMonthGrid({
        year: 2027,
        month: 2,
        logs: [],
        todayStr: "2027-02-15",
        deadline: "16:00",
        now: new Date("2027-02-15T06:30:00Z"),
      }),
    ).toHaveLength(28);
    expect(
      buildMonthGrid({
        year: 2028,
        month: 2,
        logs: [],
        todayStr: "2028-02-15",
        deadline: "16:00",
        now: new Date("2028-02-15T06:30:00Z"),
      }),
    ).toHaveLength(29);
  });

  it("weekday は日=0..土=6 (HeatmapGrid と同じ)", () => {
    // 2026-06-01 は月曜 → weekday=1
    const cells = buildMonthGrid({
      year: 2026,
      month: 6,
      logs: [],
      todayStr: "2026-06-25",
      deadline: "16:00",
      now: new Date("2026-06-25T06:30:00Z"),
    });
    expect(cells[0].weekday).toBe(1); // 月
    expect(cells[6].weekday).toBe(0); // 6/7 日
  });

  it("成功・失敗・今日・未来・empty を正しく分類", () => {
    const cells = buildMonthGrid({
      year: 2026,
      month: 6,
      logs: [
        { date: "2026-06-10", success: true },
        { date: "2026-06-11", success: false },
      ],
      todayStr: "2026-06-25",
      deadline: "16:00",
      enabledSince: "2026-06-05",
      now: new Date("2026-06-25T06:30:00Z"), // JST 15:30
    });
    const byDate = new Map(cells.map((c) => [c.date, c]));
    // 月初〜enabledSince直前 → empty
    expect(byDate.get("2026-06-01")!.state).toBe("empty");
    expect(byDate.get("2026-06-04")!.state).toBe("empty");
    // enabledSince 以降ログ無し → fail
    expect(byDate.get("2026-06-05")!.state).toBe("fail");
    // 記録あり
    expect(byDate.get("2026-06-10")!.state).toBe("success");
    expect(byDate.get("2026-06-11")!.state).toBe("fail");
    // 今日（締切前）
    expect(byDate.get("2026-06-25")!.state).toBe("today");
    // 未来
    expect(byDate.get("2026-06-26")!.state).toBe("future");
  });
});
