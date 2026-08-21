// @vitest-environment jsdom
import { render, screen, waitFor, act, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import CheckinPill from "@/components/child/CheckinPill";

function mockCalendarFetch() {
  return vi.fn().mockImplementation((url: string) => {
    if (typeof url === "string" && url.includes("/api/checkin/calendar")) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            enabled: true,
            days: 7,
            deadline: "16:00",
            logs: [{ date: "2026-06-25", success: true }],
            enabledSince: "2026-06-19",
            currentStreak: 5,
            bestStreak: 5,
          }),
      });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  }) as unknown as typeof fetch;
}

function calendarCallCount(): number {
  const mock = global.fetch as unknown as ReturnType<typeof vi.fn>;
  return mock.mock.calls.filter(
    ([url]: [string]) => typeof url === "string" && url.includes("/api/checkin/calendar"),
  ).length;
}

beforeEach(() => {
  global.fetch = mockCalendarFetch();
});

afterEach(() => {
  vi.restoreAllMocks();
});

const baseProps = {
  enabled: true,
  todayStatus: "success" as const,
  currentStreak: 5,
  deadline: "16:00",
  todayStr: "2026-06-25",
};

describe("CheckinPill", () => {
  it("初期表示は折りたたみ状態で7セルグリッドをDOMに描画しない", async () => {
    await act(async () => {
      render(<CheckinPill {...baseProps} />);
    });
    expect(screen.queryAllByTestId(/^cell-/)).toHaveLength(0);
  });

  it("初期マウント時に GET /api/checkin/calendar を呼ばない", async () => {
    await act(async () => {
      render(<CheckinPill {...baseProps} />);
    });
    expect(calendarCallCount()).toBe(0);
  });

  it("タップで展開し7セルが描画される。このとき初めて GET が1回呼ばれる", async () => {
    await act(async () => {
      render(<CheckinPill {...baseProps} />);
    });
    const toggle = screen.getByRole("button");
    await act(async () => {
      fireEvent.click(toggle);
    });
    await waitFor(() => {
      expect(screen.getAllByTestId(/^cell-/)).toHaveLength(7);
    });
    expect(calendarCallCount()).toBe(1);
  });

  it("展開→折りたたみ→再展開しても GET は2回呼ばれない（初回展開時のみ）", async () => {
    await act(async () => {
      render(<CheckinPill {...baseProps} />);
    });
    const toggle = screen.getByRole("button");

    await act(async () => {
      fireEvent.click(toggle); // 展開
    });
    await waitFor(() => {
      expect(screen.getAllByTestId(/^cell-/)).toHaveLength(7);
    });

    await act(async () => {
      fireEvent.click(toggle); // 折りたたみ
    });

    await act(async () => {
      fireEvent.click(toggle); // 再展開
    });
    await waitFor(() => {
      expect(screen.getAllByTestId(/^cell-/).length).toBeGreaterThan(0);
    });

    expect(calendarCallCount()).toBe(1);
  });

  it("開閉トグルは button であり aria-expanded が false → true に変わる", async () => {
    await act(async () => {
      render(<CheckinPill {...baseProps} />);
    });
    const toggle = screen.getByRole("button");
    expect(toggle.tagName).toBe("BUTTON");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");

    await act(async () => {
      fireEvent.click(toggle);
    });
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
  });

  it("enabled: false のとき、ピルも展開ボタンも一切描画しない", async () => {
    let container: HTMLElement | undefined;
    await act(async () => {
      const result = render(<CheckinPill {...baseProps} enabled={false} />);
      container = result.container;
    });
    expect(container?.querySelector("button")).toBeNull();
    expect(container?.textContent).toBe("");
  });

  it("展開グリッドに 🔥 N日連続！ 行と『直近7日 チェックイン』見出しが重複表示されない（embedded）", async () => {
    await act(async () => {
      render(<CheckinPill {...baseProps} />);
    });
    const toggle = screen.getByRole("button");
    await act(async () => {
      fireEvent.click(toggle);
    });
    await waitFor(() => {
      expect(screen.getAllByTestId(/^cell-/)).toHaveLength(7);
    });
    expect(screen.queryByText(/直近7日 チェックイン/)).toBeNull();
    expect(screen.queryByTestId("checkin-current-streak")).toBeNull();
  });
});
