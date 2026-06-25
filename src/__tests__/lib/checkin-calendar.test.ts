import { describe, it, expect } from "vitest";
import { buildWeekStrip } from "@/lib/checkin.calendar";

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

  it("weekday は月曜始まり (月=0..日=6)", () => {
    // 2026-06-25 は木曜 → weekday=3
    const cells = buildWeekStrip({
      todayStr: "2026-06-25",
      logs: [],
      deadline: "16:00",
      now: new Date("2026-06-25T06:30:00Z"),
    });
    expect(cells[6].weekday).toBe(3); // 木
    expect(cells[5].weekday).toBe(2); // 水
    expect(cells[0].weekday).toBe(4); // 金（6/19）
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
