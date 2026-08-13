// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useHistoryData } from "@/hooks/useHistoryData";

const FAMILY_CODE_RESPONSE = {
  members: [
    { id: "child-1", name: "たろう", role: "CHILD", monsterName: null },
  ],
};

function mockFetchSequence() {
  return vi.fn((url: string) => {
    if (url.includes("/api/family/code")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(FAMILY_CODE_RESPONSE),
      });
    }
    if (url.includes("/api/quests/monthly-summary")) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            days: {},
            achievedDays: 0,
            totalApproved: 0,
            totalXp: 0,
          }),
      });
    }
    if (url.includes("/api/quests/history")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([]),
      });
    }
    return Promise.resolve({ ok: false, json: () => Promise.resolve(null) });
  }) as unknown as typeof fetch;
}

describe("useHistoryData の isFirstLoad", () => {
  beforeEach(() => {
    global.fetch = mockFetchSequence();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("初回ロード時は isFirstLoad が true から始まる", () => {
    const selectedDate = new Date(2026, 0, 1);
    const viewMonth = new Date(2026, 0, 1);
    const { result } = renderHook(() => useHistoryData(selectedDate, viewMonth));

    expect(result.current.isFirstLoad).toBe(true);
  });

  it("初回の history フェッチ完了後は isFirstLoad が false になる", async () => {
    const selectedDate = new Date(2026, 0, 1);
    const viewMonth = new Date(2026, 0, 1);
    const { result } = renderHook(() => useHistoryData(selectedDate, viewMonth));

    await waitFor(() => {
      expect(result.current.isFirstLoad).toBe(false);
    });

    expect(result.current.loadingItems).toBe(false);
  });

  it("2回目以降の history フェッチが完了しても isFirstLoad は false のまま", async () => {
    const viewMonth = new Date(2026, 0, 1);
    const { result, rerender } = renderHook(
      ({ selectedDate }) => useHistoryData(selectedDate, viewMonth),
      { initialProps: { selectedDate: new Date(2026, 0, 1) } }
    );

    await waitFor(() => {
      expect(result.current.isFirstLoad).toBe(false);
    });

    // 日付を変えて2回目のフェッチをトリガー
    rerender({ selectedDate: new Date(2026, 0, 2) });

    await waitFor(() => {
      expect(result.current.loadingItems).toBe(false);
    });

    expect(result.current.isFirstLoad).toBe(false);
  });
});
