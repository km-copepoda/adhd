// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/app/child/quests",
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    channel: () => ({
      on: function () { return this; },
      subscribe: () => ({}),
    }),
    removeChannel: vi.fn(),
  }),
}));

import BottomNav from "@/components/child/BottomNav";

type TreasureStatus = {
  locked: number;
  unlocked: number;
  hasPool: boolean;
  opened: unknown[];
};

function mockFetch(treasureStatus: TreasureStatus) {
  global.fetch = vi.fn().mockImplementation((url: string) => {
    if (url.includes("/api/treasures/status")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(treasureStatus),
      });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  vi.clearAllMocks();
  // localStorage を毎回クリア（hasPool キャッシュが残らないように）
  try { localStorage.clear(); } catch {}
});

describe("子 BottomNav 宝箱タブの条件表示", () => {
  it("プール未設定 & 在庫ゼロなら「宝箱」タブを非表示", async () => {
    mockFetch({ locked: 0, unlocked: 0, hasPool: false, opened: [] });
    render(<BottomNav />);
    await waitFor(() => {
      expect(screen.queryByText("宝箱")).toBeNull();
    });
  });

  it("プールが設定済みなら「宝箱」タブを表示", async () => {
    mockFetch({ locked: 0, unlocked: 0, hasPool: true, opened: [] });
    render(<BottomNav />);
    await waitFor(() => {
      expect(screen.getByText("宝箱")).toBeTruthy();
    });
  });

  it("プール未設定でも UNLOCKED が残っていれば「宝箱」タブを表示 (救済アクセス)", async () => {
    mockFetch({ locked: 0, unlocked: 2, hasPool: false, opened: [] });
    render(<BottomNav />);
    await waitFor(() => {
      expect(screen.getByText("宝箱")).toBeTruthy();
    });
  });

  it("プール未設定でも LOCKED が残っていれば「宝箱」タブを表示", async () => {
    mockFetch({ locked: 1, unlocked: 0, hasPool: false, opened: [] });
    render(<BottomNav />);
    await waitFor(() => {
      expect(screen.getByText("宝箱")).toBeTruthy();
    });
  });
});
