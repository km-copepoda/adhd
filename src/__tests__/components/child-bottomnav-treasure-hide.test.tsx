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
  try { localStorage.clear(); } catch {}
});

// 宝箱タブは常に表示する仕様（コレクションアイテム実装後の方針 2026-05-31）。
// ハズレ枠が必ずコレクションアイテムになるため、親がプール未設定でも子供は
// 宝箱から確定報酬を得られる。タブを隠してしまうとそのことを伝えられない。
describe("子 BottomNav 宝箱タブは常に表示される", () => {
  it("初期 localStorage キャッシュが treasureHasPool=false でも、宝箱タブを表示する", async () => {
    // 旧仕様のキャッシュが残っているケース。新仕様では無視して常に表示する。
    try { localStorage.setItem("treasureHasPool", "false"); } catch {}
    mockFetch({ locked: 0, unlocked: 0, hasPool: false, opened: [] });
    render(<BottomNav />);
    expect(screen.getByText("宝箱")).toBeTruthy();
  });

  it("プール未設定 & 在庫ゼロ (fetch 後) でも「宝箱」タブを表示し続ける", async () => {
    mockFetch({ locked: 0, unlocked: 0, hasPool: false, opened: [] });
    render(<BottomNav />);
    // fetch が完了して状態が更新された後も維持されることを担保
    await waitFor(() => {
      expect((global.fetch as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
        expect.stringContaining("/api/treasures/status"),
      );
    });
    expect(screen.getByText("宝箱")).toBeTruthy();
  });

  it("プール設定済みでも表示", async () => {
    mockFetch({ locked: 0, unlocked: 0, hasPool: true, opened: [] });
    render(<BottomNav />);
    expect(screen.getByText("宝箱")).toBeTruthy();
  });

  it("UNLOCKED が残っているとき表示", async () => {
    mockFetch({ locked: 0, unlocked: 2, hasPool: false, opened: [] });
    render(<BottomNav />);
    expect(screen.getByText("宝箱")).toBeTruthy();
  });

  it("LOCKED が残っているとき表示", async () => {
    mockFetch({ locked: 1, unlocked: 0, hasPool: false, opened: [] });
    render(<BottomNav />);
    expect(screen.getByText("宝箱")).toBeTruthy();
  });
});
