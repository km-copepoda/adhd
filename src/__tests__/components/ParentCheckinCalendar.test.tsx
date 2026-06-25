// @vitest-environment jsdom
import { render, screen, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import ParentCheckinCalendar from "@/components/parent/ParentCheckinCalendar";

function mockApi(payload: object) {
  global.fetch = vi.fn().mockImplementation((url: string) => {
    if (typeof url === "string" && url.includes("/api/parent/checkin/calendar")) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(payload) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  }) as unknown as typeof fetch;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ParentCheckinCalendar", () => {
  beforeEach(() => {
    mockApi({
      enabled: true,
      year: 2026,
      month: 6,
      deadline: "16:00",
      logs: [
        { date: "2026-06-10", success: true },
        { date: "2026-06-11", success: false },
      ],
      enabledSince: "2026-06-05",
      currentStreak: 3,
      bestStreak: 9,
    });
  });

  it("enabled=false なら何も描画しない", async () => {
    mockApi({
      enabled: false,
      year: 2026,
      month: 6,
      deadline: null,
      logs: [],
      enabledSince: null,
      currentStreak: 0,
      bestStreak: 0,
    });
    let container: HTMLElement;
    await act(async () => {
      const result = render(
        <ParentCheckinCalendar
          childId="child-1"
          viewMonth={new Date(2026, 5, 1)}
          todayStr="2026-06-25"
        />,
      );
      container = result.container;
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(container!.firstChild).toBeNull();
  });

  it("見出しに締切が表示される", async () => {
    await act(async () => {
      render(
        <ParentCheckinCalendar
          childId="child-1"
          viewMonth={new Date(2026, 5, 1)}
          todayStr="2026-06-25"
        />,
      );
    });
    await waitFor(() => {
      expect(screen.getByText(/締切 16:00/)).toBeTruthy();
    });
  });

  it("成功日は success state", async () => {
    await act(async () => {
      render(
        <ParentCheckinCalendar
          childId="child-1"
          viewMonth={new Date(2026, 5, 1)}
          todayStr="2026-06-25"
        />,
      );
    });
    await waitFor(() => {
      const cell = screen.getByTestId("parent-cell-2026-06-10");
      expect(cell.getAttribute("data-state")).toBe("success");
    });
  });

  it("enabledSince より前の日は empty で「-」表示", async () => {
    await act(async () => {
      render(
        <ParentCheckinCalendar
          childId="child-1"
          viewMonth={new Date(2026, 5, 1)}
          todayStr="2026-06-25"
        />,
      );
    });
    await waitFor(() => {
      const cell = screen.getByTestId("parent-cell-2026-06-01");
      expect(cell.getAttribute("data-state")).toBe("empty");
      expect(cell.textContent).toContain("-");
    });
  });

  it("未来日は future（空表示）", async () => {
    await act(async () => {
      render(
        <ParentCheckinCalendar
          childId="child-1"
          viewMonth={new Date(2026, 5, 1)}
          todayStr="2026-06-25"
        />,
      );
    });
    await waitFor(() => {
      const cell = screen.getByTestId("parent-cell-2026-06-30");
      expect(cell.getAttribute("data-state")).toBe("future");
    });
  });

  it("childId 変更時に再フェッチする", async () => {
    const mockFn = global.fetch as unknown as ReturnType<typeof vi.fn>;
    let result: ReturnType<typeof render>;
    await act(async () => {
      result = render(
        <ParentCheckinCalendar
          childId="child-1"
          viewMonth={new Date(2026, 5, 1)}
          todayStr="2026-06-25"
        />,
      );
    });
    await waitFor(() => {
      expect(mockFn).toHaveBeenCalledTimes(1);
    });
    await act(async () => {
      result!.rerender(
        <ParentCheckinCalendar
          childId="child-2"
          viewMonth={new Date(2026, 5, 1)}
          todayStr="2026-06-25"
        />,
      );
    });
    await waitFor(() => {
      expect(mockFn).toHaveBeenCalledTimes(2);
    });
  });
});
