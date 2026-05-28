// @vitest-environment jsdom
import { render, screen, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

let mockPath = "/app/child/quests";
vi.mock("next/navigation", () => ({
  usePathname: () => mockPath,
}));

const realtimeHandlers: Record<string, (payload: unknown) => void> = {};
let realtimeChannelKey = "";

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    channel: (key: string) => {
      realtimeChannelKey = key;
      return {
        on: function (
          _event: string,
          opts: { table?: string },
          cb: (payload: unknown) => void,
        ) {
          if (opts?.table) realtimeHandlers[opts.table] = cb;
          return this;
        },
        subscribe: () => ({}),
      };
    },
    removeChannel: vi.fn(),
  }),
}));

import BottomNav from "@/components/child/BottomNav";

function buildFetch(treasureStatus: { locked: number; unlocked: number; opened?: unknown[] }) {
  return vi.fn().mockImplementation((url: string) => {
    if (url.includes("/api/treasures/status")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ opened: [], ...treasureStatus }),
      });
    }
    if (url.includes("/api/monster-status")) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            evolutionStage: 0,
            evolutionPath: "",
            collectedPaths: "[]",
            studyPt: 0,
            staminaPt: 0,
            lifePt: 0,
            rebirthPending: false,
          }),
      });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  mockPath = "/app/child/quests";
  Object.keys(realtimeHandlers).forEach((k) => delete realtimeHandlers[k]);
  realtimeChannelKey = "";
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("子 BottomNav 宝箱バッジ", () => {
  it("locked+unlocked が 0 ならバッジを表示しない", async () => {
    global.fetch = buildFetch({ locked: 0, unlocked: 0 });
    await act(async () => {
      render(<BottomNav />);
    });
    await waitFor(() => {
      const treasureLink = screen.getByText("宝箱").closest("a") as HTMLElement;
      expect(treasureLink.querySelector(".bg-red-500")).toBeNull();
    });
  });

  it("locked+unlocked > 0 のとき宝箱タブにバッジ数字を表示する", async () => {
    global.fetch = buildFetch({ locked: 2, unlocked: 3 });
    await act(async () => {
      render(<BottomNav />);
    });
    await waitFor(() => {
      const treasureLink = screen.getByText("宝箱").closest("a") as HTMLElement;
      const badge = treasureLink.querySelector(".bg-red-500");
      expect(badge).toBeTruthy();
      expect(badge?.textContent).toBe("5");
    });
  });

  it("9 を超えるときは 9+ と表示する", async () => {
    global.fetch = buildFetch({ locked: 7, unlocked: 5 });
    await act(async () => {
      render(<BottomNav />);
    });
    await waitFor(() => {
      const treasureLink = screen.getByText("宝箱").closest("a") as HTMLElement;
      expect(treasureLink.querySelector(".bg-red-500")?.textContent).toBe("9+");
    });
  });

  it("宝箱タブを開いているときはバッジを表示しない", async () => {
    mockPath = "/app/child/treasures";
    global.fetch = buildFetch({ locked: 2, unlocked: 3 });
    await act(async () => {
      render(<BottomNav />);
    });
    await waitFor(() => {
      const treasureLink = screen.getByText("宝箱").closest("a") as HTMLElement;
      expect(treasureLink.querySelector(".bg-red-500")).toBeNull();
    });
  });

  it("Realtime で TreasureLog の変更が来たらカウントを再フェッチする", async () => {
    let locked = 0;
    let unlocked = 0;
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/api/treasures/status")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ locked, unlocked, opened: [] }),
        });
      }
      if (url.includes("/api/monster-status")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              evolutionStage: 0,
              evolutionPath: "",
              collectedPaths: "[]",
              studyPt: 0,
              staminaPt: 0,
              lifePt: 0,
              rebirthPending: false,
            }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }) as unknown as typeof fetch;

    await act(async () => {
      render(<BottomNav />);
    });
    await waitFor(() => {
      const treasureLink = screen.getByText("宝箱").closest("a") as HTMLElement;
      expect(treasureLink.querySelector(".bg-red-500")).toBeNull();
    });

    // 宝箱が追加されたとシミュレート
    locked = 1;
    await act(async () => {
      realtimeHandlers["TreasureLog"]?.({ eventType: "INSERT" });
    });

    await waitFor(() => {
      const treasureLink = screen.getByText("宝箱").closest("a") as HTMLElement;
      expect(treasureLink.querySelector(".bg-red-500")?.textContent).toBe("1");
    });
  });
});
