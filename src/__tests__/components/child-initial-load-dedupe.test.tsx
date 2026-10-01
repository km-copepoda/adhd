// @vitest-environment jsdom
import { render, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/app/child/quests",
}));

const channelFactory = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    channel: (name: string) => {
      channelFactory(name);
      const ch = {
        on: () => ch,
        subscribe: () => ch,
      };
      return ch;
    },
    removeChannel: vi.fn(),
  }),
}));

import BottomNav from "@/components/child/BottomNav";
import MonsterCutsceneListener from "@/components/child/MonsterCutsceneListener";
import BadgeUnlockToast from "@/components/child/BadgeUnlockToast";
import TreasureStock from "@/components/child/TreasureStock";

function mockFetch() {
  global.fetch = vi.fn().mockImplementation(() =>
    Promise.resolve(
      new Response(
        JSON.stringify({
          evolutionStage: 1,
          evolutionPath: "",
          side: null,
          collectedPaths: "[]",
          locked: 0,
          unlocked: 0,
          unlockedCount: 0,
          currentStreak: 0,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    ),
  ) as unknown as typeof fetch;
}

function callsTo(path: string): number {
  const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls;
  return calls.filter(([url]) => String(url).includes(path)).length;
}

beforeEach(() => {
  vi.clearAllMocks();
  try {
    localStorage.clear();
  } catch {
    /* ignore */
  }
});

// 子供画面の初回表示で、layout 常駐コンポーネントとページが同じ API / Realtime を
// それぞれ別に叩いていた問題（Issue #154）の回帰テスト。
describe("子供画面の初回表示: 同一リソースの重複取得を避ける", () => {
  it("monster-status / treasures/status / quests/today は同時マウントでも1回しか取得しない", async () => {
    mockFetch();
    render(
      <>
        <BottomNav />
        <MonsterCutsceneListener />
        <TreasureStock variant="card" />
      </>,
    );

    await waitFor(() => {
      expect(callsTo("/api/monster-status")).toBeGreaterThan(0);
      expect(callsTo("/api/treasures/status")).toBeGreaterThan(0);
      expect(callsTo("/api/quests/today")).toBeGreaterThan(0);
    });

    expect(callsTo("/api/monster-status")).toBe(1);
    expect(callsTo("/api/treasures/status")).toBe(1);
    expect(callsTo("/api/quests/today")).toBe(1);
  });

  it("BottomNav / MonsterCutsceneListener / BadgeUnlockToast を同時に出しても Realtime チャンネルは1本", () => {
    mockFetch();
    render(
      <>
        <BottomNav />
        <MonsterCutsceneListener />
        <BadgeUnlockToast />
      </>,
    );

    expect(channelFactory).toHaveBeenCalledTimes(1);
  });
});
