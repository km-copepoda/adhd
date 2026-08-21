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
            days: 7,
            deadline: "16:00",
            logs: [
              { date: "2026-06-23", success: true },
              { date: "2026-06-25", success: true },
            ],
            enabledSince: "2026-06-22",
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
  it("見出しに「直近7日」を表示する", async () => {
    await act(async () => {
      render(<CheckinCalendar deadline="16:00" todayStr="2026-06-25" />);
    });
    await waitFor(() => {
      expect(screen.getByText(/直近7日/)).toBeTruthy();
    });
  });

  it("連続日数を表示する", async () => {
    await act(async () => {
      render(<CheckinCalendar deadline="16:00" todayStr="2026-06-25" />);
    });
    await waitFor(() => {
      expect(screen.getByTestId("checkin-current-streak").textContent).toContain("6");
    });
  });

  it("成功日のセルに success state を付ける", async () => {
    await act(async () => {
      render(<CheckinCalendar deadline="16:00" todayStr="2026-06-25" />);
    });
    await waitFor(() => {
      const cell = screen.getByTestId("cell-2026-06-23");
      expect(cell.getAttribute("data-state")).toBe("success");
    });
  });

  it("enabledSince より前の日（ログなし）は empty で「-」表示", async () => {
    await act(async () => {
      render(<CheckinCalendar deadline="16:00" todayStr="2026-06-25" />);
    });
    await waitFor(() => {
      // 6/19 は enabledSince=2026-06-22 より前 → empty
      const cell = screen.getByTestId("cell-2026-06-19");
      expect(cell.getAttribute("data-state")).toBe("empty");
      expect(cell.textContent).toContain("-");
    });
  });

  it("過去日でログなし、かつ enabledSince 以降は fail（😢）のまま", async () => {
    await act(async () => {
      render(<CheckinCalendar deadline="16:00" todayStr="2026-06-25" />);
    });
    await waitFor(() => {
      // 6/24 は enabledSince=2026-06-22 以降だがログ無し → fail
      const cell = screen.getByTestId("cell-2026-06-24");
      expect(cell.getAttribute("data-state")).toBe("fail");
    });
  });

  it("justNow=true 時は今日のセルに animate 属性が付く", async () => {
    await act(async () => {
      render(
        <CheckinCalendar
          deadline="16:00"
          todayStr="2026-06-25"
          justNow={true}
        />,
      );
    });
    await waitFor(() => {
      const cell = screen.getByTestId("cell-2026-06-25");
      expect(cell.getAttribute("data-animate")).toBe("true");
    });
  });

  it("ちょうど 7 セル描画する", async () => {
    await act(async () => {
      render(<CheckinCalendar deadline="16:00" todayStr="2026-06-25" />);
    });
    await waitFor(() => {
      const cells = screen.getAllByTestId(/^cell-/);
      expect(cells).toHaveLength(7);
    });
  });

  it("variant 未指定（既定）で従来どおり見出し・締切ラベル・連続日数を表示する（回帰）", async () => {
    await act(async () => {
      render(<CheckinCalendar deadline="16:00" todayStr="2026-06-25" />);
    });
    await waitFor(() => {
      expect(screen.getByText(/直近7日/)).toBeTruthy();
      expect(screen.getByText(/締切 16:00/)).toBeTruthy();
      expect(screen.getByTestId("checkin-current-streak")).toBeTruthy();
    });
  });

  it("variant='standalone' を明示しても従来どおり見出し・連続日数を表示する（回帰）", async () => {
    await act(async () => {
      render(
        <CheckinCalendar deadline="16:00" todayStr="2026-06-25" variant="standalone" />,
      );
    });
    await waitFor(() => {
      expect(screen.getByText(/直近7日/)).toBeTruthy();
      expect(screen.getByTestId("checkin-current-streak")).toBeTruthy();
    });
  });

  it("variant='embedded' では見出し・連続日数を描画しない", async () => {
    await act(async () => {
      render(
        <CheckinCalendar deadline="16:00" todayStr="2026-06-25" variant="embedded" />,
      );
    });
    await waitFor(() => {
      expect(screen.getAllByTestId(/^cell-/)).toHaveLength(7);
    });
    expect(screen.queryByText(/直近7日 チェックイン/)).toBeNull();
    expect(screen.queryByTestId("checkin-current-streak")).toBeNull();
  });

  it("variant='embedded' でもセルの state（success/fail/empty/today/future）描画は不変", async () => {
    await act(async () => {
      render(
        <CheckinCalendar deadline="16:00" todayStr="2026-06-25" variant="embedded" />,
      );
    });
    await waitFor(() => {
      expect(screen.getByTestId("cell-2026-06-23").getAttribute("data-state")).toBe(
        "success",
      );
      expect(screen.getByTestId("cell-2026-06-19").getAttribute("data-state")).toBe(
        "empty",
      );
      expect(screen.getByTestId("cell-2026-06-24").getAttribute("data-state")).toBe(
        "fail",
      );
      expect(screen.getByTestId("cell-2026-06-25").getAttribute("data-state")).toBe(
        "success",
      );
    });
  });
});
