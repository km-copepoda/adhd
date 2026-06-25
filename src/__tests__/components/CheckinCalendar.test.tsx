// @vitest-environment jsdom
import { render, screen, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import CheckinCalendar from "@/components/child/CheckinCalendar";

beforeEach(() => {
  global.fetch = vi.fn().mockImplementation((url: string) => {
    if (typeof url === "string" && url.includes("/api/checkin/calendar")) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            enabled: true,
            year: 2026,
            month: 6,
            deadline: "16:00",
            logs: [
              { date: "2026-06-01", success: true },
              { date: "2026-06-02", success: false },
              { date: "2026-06-23", success: true },
            ],
            currentStreak: 6,
            bestStreak: 12,
          }),
      });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  }) as unknown as typeof fetch;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("CheckinCalendar", () => {
  it("API レスポンスから月見出しを表示する", async () => {
    await act(async () => {
      render(<CheckinCalendar deadline="16:00" todayStr="2026-06-23" />);
    });
    await waitFor(() => {
      expect(screen.getByText(/6月/)).toBeTruthy();
    });
  });

  it("連続日数を表示する", async () => {
    await act(async () => {
      render(<CheckinCalendar deadline="16:00" todayStr="2026-06-23" />);
    });
    await waitFor(() => {
      expect(screen.getByTestId("checkin-current-streak").textContent).toContain("6");
    });
  });

  it("成功日のセルに success-state クラスを付ける", async () => {
    await act(async () => {
      render(<CheckinCalendar deadline="16:00" todayStr="2026-06-23" />);
    });
    await waitFor(() => {
      const cell = screen.getByTestId("cell-2026-06-01");
      expect(cell.getAttribute("data-state")).toBe("success");
    });
  });

  it("過去日のログなしセルは fail", async () => {
    await act(async () => {
      render(<CheckinCalendar deadline="16:00" todayStr="2026-06-23" />);
    });
    await waitFor(() => {
      const cell = screen.getByTestId("cell-2026-06-05");
      expect(cell.getAttribute("data-state")).toBe("fail");
    });
  });

  it("justNow=true 時は今日のセルに animate 属性が付く", async () => {
    await act(async () => {
      render(
        <CheckinCalendar
          deadline="16:00"
          todayStr="2026-06-23"
          justNow={true}
        />,
      );
    });
    await waitFor(() => {
      const cell = screen.getByTestId("cell-2026-06-23");
      expect(cell.getAttribute("data-animate")).toBe("true");
    });
  });
});
