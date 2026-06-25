import { describe, it, expect } from "vitest";
import {
  buildCalendarGrid,
  type CalendarCell,
} from "@/lib/checkin.calendar";

describe("buildCalendarGrid", () => {
  // 2026-06 は月初が月曜（JST）。月曜始まりカレンダーで先頭が 6/1
  it("2026-06 のカレンダーは月曜始まりで 6/1 が先頭", () => {
    const grid = buildCalendarGrid({
      year: 2026,
      month: 6,
      logs: [],
      todayStr: "2026-06-23",
      deadline: "16:00",
      now: new Date("2026-06-23T06:30:00Z"), // JST 15:30
    });
    // 月曜始まり: 月火水木金土日 = 7列
    expect(grid[0]).toHaveLength(7);
    expect(grid[0][0].date).toBe("2026-06-01"); // 月曜
  });

  it("成功日には success、今日は today、未来は future、過去無記録は fail", () => {
    const grid = buildCalendarGrid({
      year: 2026,
      month: 6,
      logs: [
        { date: "2026-06-01", success: true },
        { date: "2026-06-02", success: false },
      ],
      todayStr: "2026-06-23",
      deadline: "16:00",
      now: new Date("2026-06-23T06:30:00Z"), // JST 15:30 (before deadline)
    });
    const flat: CalendarCell[] = grid.flat();
    const byDate = new Map(flat.map((c) => [c.date, c]));

    expect(byDate.get("2026-06-01")!.state).toBe("success");
    expect(byDate.get("2026-06-02")!.state).toBe("fail");
    // 過去日でログなしは fail
    expect(byDate.get("2026-06-03")!.state).toBe("fail");
    // 今日は締切前なので today
    expect(byDate.get("2026-06-23")!.state).toBe("today");
    // 未来日
    expect(byDate.get("2026-06-24")!.state).toBe("future");
  });

  it("今日が締切後で未チェックインなら fail", () => {
    const grid = buildCalendarGrid({
      year: 2026,
      month: 6,
      logs: [],
      todayStr: "2026-06-23",
      deadline: "16:00",
      now: new Date("2026-06-23T08:00:00Z"), // JST 17:00 (after deadline)
    });
    const cell = grid.flat().find((c) => c.date === "2026-06-23")!;
    expect(cell.state).toBe("fail");
  });

  it("月外日（先月・来月）は empty", () => {
    const grid = buildCalendarGrid({
      year: 2026,
      month: 7, // 7月: 7/1 は水曜 → 月火が前月のはみ出し
      logs: [],
      todayStr: "2026-07-15",
      deadline: "16:00",
      now: new Date("2026-07-15T06:30:00Z"),
    });
    const first = grid[0];
    // 月外（7月以外）は empty
    expect(first[0].state).toBe("empty"); // 月（6/29）
    expect(first[1].state).toBe("empty"); // 火（6/30）
    expect(first[2].date).toBe("2026-07-01");
  });

  it("enabledSince より前の月内日は empty（設定前は表示しない）", () => {
    const grid = buildCalendarGrid({
      year: 2026,
      month: 6,
      logs: [],
      todayStr: "2026-06-23",
      deadline: "16:00",
      enabledSince: "2026-06-10",
      now: new Date("2026-06-23T06:30:00Z"),
    });
    const flat = grid.flat();
    const c5 = flat.find((c) => c.date === "2026-06-05")!;
    const c10 = flat.find((c) => c.date === "2026-06-10")!;
    expect(c5.state).toBe("empty");
    expect(c10.state).toBe("fail"); // enabledSince 当日のログなしは fail
  });
});
