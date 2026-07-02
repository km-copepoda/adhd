// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import HeatmapGrid from "@/components/parent/HeatmapGrid";

const noop = vi.fn();

describe("HeatmapGrid + チェックイン統合表示", () => {
  it("checkinDays を渡すと該当日のセル内にチェックインアイコンが描画される (success)", () => {
    const viewMonth = new Date(2026, 5, 1); // 2026-06
    const today = new Date(2026, 5, 25);
    render(
      <HeatmapGrid
        viewMonth={viewMonth}
        today={today}
        selectedDate={today}
        days={undefined}
        onPrevMonth={noop}
        onNextMonth={noop}
        onSelectDate={noop}
        checkinDays={{
          "2026-06-10": "success",
          "2026-06-11": "fail",
          "2026-06-25": "today",
        }}
      />,
    );
    const success = screen.getByTestId("heatmap-checkin-2026-06-10");
    expect(success.getAttribute("data-checkin")).toBe("success");
    expect(success.textContent).toContain("🌟");

    const fail = screen.getByTestId("heatmap-checkin-2026-06-11");
    expect(fail.getAttribute("data-checkin")).toBe("fail");
    expect(fail.textContent).toContain("😢");

    const todayCell = screen.getByTestId("heatmap-checkin-2026-06-25");
    expect(todayCell.getAttribute("data-checkin")).toBe("today");
    expect(todayCell.textContent).toContain("⭐");
  });

  it("checkinDays に無い日はアイコンを描画しない", () => {
    const viewMonth = new Date(2026, 5, 1);
    const today = new Date(2026, 5, 25);
    render(
      <HeatmapGrid
        viewMonth={viewMonth}
        today={today}
        selectedDate={today}
        days={undefined}
        onPrevMonth={noop}
        onNextMonth={noop}
        onSelectDate={noop}
        checkinDays={{ "2026-06-10": "success" }}
      />,
    );
    expect(screen.queryByTestId("heatmap-checkin-2026-06-11")).toBeNull();
    expect(screen.queryByTestId("heatmap-checkin-2026-06-01")).toBeNull();
  });

  it("checkinDays を渡さない場合は何もアイコンを描画しない (後方互換)", () => {
    const viewMonth = new Date(2026, 5, 1);
    const today = new Date(2026, 5, 25);
    render(
      <HeatmapGrid
        viewMonth={viewMonth}
        today={today}
        selectedDate={today}
        days={undefined}
        onPrevMonth={noop}
        onNextMonth={noop}
        onSelectDate={noop}
      />,
    );
    for (let d = 1; d <= 30; d++) {
      const dateStr = `2026-06-${String(d).padStart(2, "0")}`;
      expect(screen.queryByTestId(`heatmap-checkin-${dateStr}`)).toBeNull();
    }
  });

  it("empty state はアイコンを描画しない (enabledSince より前)", () => {
    const viewMonth = new Date(2026, 5, 1);
    const today = new Date(2026, 5, 25);
    render(
      <HeatmapGrid
        viewMonth={viewMonth}
        today={today}
        selectedDate={today}
        days={undefined}
        onPrevMonth={noop}
        onNextMonth={noop}
        onSelectDate={noop}
        checkinDays={{ "2026-06-05": "empty", "2026-06-10": "success" }}
      />,
    );
    expect(screen.queryByTestId("heatmap-checkin-2026-06-05")).toBeNull();
    expect(screen.getByTestId("heatmap-checkin-2026-06-10")).toBeTruthy();
  });
});
