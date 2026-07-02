// @vitest-environment jsdom
import { render, screen, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import HistoryContent from "@/components/parent/HistoryContent";

type Payload = Record<string, unknown> | unknown[];

function mockRoutes(routes: Record<string, Payload>) {
  global.fetch = vi.fn().mockImplementation((url: string) => {
    for (const [pattern, payload] of Object.entries(routes)) {
      if (typeof url === "string" && url.includes(pattern)) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(payload) });
      }
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  mockRoutes({
    "/api/family/code": {
      members: [
        { id: "child-1", name: "たろう", monsterName: "モン", role: "CHILD" },
      ],
    },
    "/api/quests/monthly-summary": {
      days: {},
      achievedDays: 0,
      totalApproved: 0,
      totalXp: 0,
    },
    "/api/quests/history": [],
    "/api/parent/checkin/calendar": {
      enabled: true,
      year: new Date().getFullYear(),
      month: new Date().getMonth() + 1,
      deadline: "16:00",
      logs: [
        { date: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-01`, success: true },
      ],
      enabledSince: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-01`,
      currentStreak: 3,
      bestStreak: 5,
    },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("HistoryContent + チェックイン統合", () => {
  it("ParentCheckinCalendar は描画しない（HeatmapGrid に統合された）", async () => {
    await act(async () => {
      render(<HistoryContent />);
    });
    await waitFor(() => {
      // ParentCheckinCalendar が描画すると parent-cell-* が存在するはず。
      // 統合後は HeatmapGrid だけなので、これらは 0 件でなければならない。
      const oldCells = document.querySelectorAll('[data-testid^="parent-cell-"]');
      expect(oldCells.length).toBe(0);
    });
  });

  it("/api/parent/checkin/calendar を呼び出し、HeatmapGrid のセル内にチェックインアイコンを表示する", async () => {
    await act(async () => {
      render(<HistoryContent />);
    });
    await waitFor(() => {
      const y = new Date().getFullYear();
      const m = String(new Date().getMonth() + 1).padStart(2, "0");
      const target = `${y}-${m}-01`;
      const icon = screen.getByTestId(`heatmap-checkin-${target}`);
      expect(icon.getAttribute("data-checkin")).toBe("success");
    });
    const calls = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.map(
      (c) => c[0] as string,
    );
    expect(calls.some((u) => u.includes("/api/parent/checkin/calendar"))).toBe(true);
  });

  it("checkin API が enabled:false を返すときはアイコンを描画しない", async () => {
    mockRoutes({
      "/api/family/code": {
        members: [
          { id: "child-1", name: "たろう", monsterName: "モン", role: "CHILD" },
        ],
      },
      "/api/quests/monthly-summary": {
        days: {},
        achievedDays: 0,
        totalApproved: 0,
        totalXp: 0,
      },
      "/api/quests/history": [],
      "/api/parent/checkin/calendar": {
        enabled: false,
        year: new Date().getFullYear(),
        month: new Date().getMonth() + 1,
        deadline: null,
        logs: [],
        enabledSince: null,
        currentStreak: 0,
        bestStreak: 0,
      },
    });
    await act(async () => {
      render(<HistoryContent />);
    });
    await waitFor(() => {
      const icons = document.querySelectorAll('[data-testid^="heatmap-checkin-"]');
      expect(icons.length).toBe(0);
    });
  });
});
