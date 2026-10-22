// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

const fetchDedupedMock = vi.fn();
vi.mock("@/lib/fetchDeduped", () => ({
  fetchDeduped: (...args: unknown[]) => fetchDedupedMock(...args),
}));
vi.mock("@/lib/childRealtime", () => ({
  subscribeChildRealtime: () => () => {},
}));

import { useChildQuests } from "@/hooks/useChildQuests";
import { useMonsterStatus } from "@/hooks/useMonsterStatus";
import { useApiFetch } from "@/hooks/useApiFetch";
import { useHistoryData } from "@/hooks/useHistoryData";

beforeEach(() => {
  fetchDedupedMock.mockReset();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useChildQuests: fetch reject でも loading 解除 (#191)", () => {
  it("fetchQuests が reject しても loading が false になる", async () => {
    fetchDedupedMock.mockRejectedValue(new TypeError("offline"));
    const { result } = renderHook(() => useChildQuests());
    await waitFor(() => expect(result.current.loading).toBe(false));
  });
});

describe("useMonsterStatus: visibilitychange で applyStatus (#191)", () => {
  const status = (name: string) => ({
    name, side: null, monsterSetId: "dark", evolutionStage: 1, evolutionPath: "",
    collectedPaths: "[]", studyPt: 0, staminaPt: 0, lifePt: 0,
    pendingStudyPt: 0, pendingStaminaPt: 0, pendingLifePt: 0,
    currentStreak: 0, bestStreak: 0, monthlyDays: 0, lastAchievedDate: null, currentTitle: null,
  });
  it("画面復帰時の取得結果が data に反映される", async () => {
    fetchDedupedMock.mockResolvedValueOnce({ ok: true, json: async () => status("A") });
    const { result } = renderHook(() => useMonsterStatus());
    await waitFor(() => expect(result.current.data?.name).toBe("A"));
    fetchDedupedMock.mockResolvedValueOnce({ ok: true, json: async () => status("B") });
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await waitFor(() => expect(result.current.data?.name).toBe("B"));
  });
});

type Deferred = { resolve: (v: unknown) => void };

describe("useApiFetch: 古い応答が新しい応答を上書きしない (#191)", () => {
  it("url 変更後、先のリクエストの遅延応答は無視される", async () => {
    const pending: Record<string, Deferred> = {};
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => new Promise((resolve) => { pending[url] = { resolve }; })),
    );
    const { result, rerender } = renderHook(({ u }) => useApiFetch<{ v: string }>(u), {
      initialProps: { u: "/api/a" },
    });
    rerender({ u: "/api/b" });
    await act(async () => {
      pending["/api/b"].resolve({ ok: true, status: 200, json: async () => ({ v: "B" }) });
    });
    await waitFor(() => expect(result.current.data).toEqual({ v: "B" }));
    await act(async () => {
      pending["/api/a"].resolve({ ok: true, status: 200, json: async () => ({ v: "A" }) });
    });
    expect(result.current.data).toEqual({ v: "B" });
    expect(result.current.loading).toBe(false);
  });
});

describe("useHistoryData (#191)", () => {
  it("/api/family/code が reject しても loadingSummary が解除される", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    const { result } = renderHook(() => useHistoryData(new Date(2026, 2, 12), new Date(2026, 2, 1)));
    await waitFor(() => expect(result.current.loadingSummary).toBe(false));
  });

  it("日付切替後、古い履歴応答は無視される", async () => {
    const pending: Record<string, Deferred> = {};
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      if (url.includes("/api/family/code")) {
        return Promise.resolve({ ok: true, json: async () => ({ members: [{ id: "c1", name: "x", role: "CHILD", monsterName: null }] }) });
      }
      if (url.includes("monthly-summary")) {
        return Promise.resolve({ ok: true, json: async () => ({ days: {}, achievedDays: 0, totalApproved: 0, totalXp: 0 }) });
      }
      return new Promise((resolve) => { pending[url] = { resolve }; });
    }));
    const month = new Date(2026, 2, 1);
    const k10 = "/api/quests/history?date=2026-03-10&childId=c1";
    const k11 = "/api/quests/history?date=2026-03-11&childId=c1";
    const { result, rerender } = renderHook(({ d }) => useHistoryData(d, month), {
      initialProps: { d: new Date(2026, 2, 10) },
    });
    await waitFor(() => expect(Object.keys(pending)).toContain(k10));
    rerender({ d: new Date(2026, 2, 11) });
    await waitFor(() => expect(Object.keys(pending)).toContain(k11));
    await act(async () => {
      pending[k11].resolve({ ok: true, json: async () => [{ id: "new" }] });
    });
    await act(async () => {
      pending[k10].resolve({ ok: true, json: async () => [{ id: "old" }] });
    });
    expect(result.current.items).toEqual([{ id: "new" }]);
  });
});
