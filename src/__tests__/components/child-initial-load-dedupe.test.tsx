// @vitest-environment jsdom
import { cleanup, render, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/app/child/quests",
}));

const channelFactory = vi.fn();
const removeChannelFn = vi.fn();
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
    removeChannel: removeChannelFn,
  }),
}));

import BottomNav from "@/components/child/BottomNav";
import MonsterCutsceneListener from "@/components/child/MonsterCutsceneListener";
import BadgeUnlockToast from "@/components/child/BadgeUnlockToast";
import TreasureStock from "@/components/child/TreasureStock";
import BadgesContent from "@/components/child/BadgesContent";

const BADGES_PAYLOAD = { badges: [], unlockedCount: 0, totalCount: 1, newlyUnlocked: [] };

/** /api/badges には BadgesContent が読める形、それ以外には汎用 JSON を返す */
function mockFetchWithBadges() {
  global.fetch = vi.fn().mockImplementation((url: unknown) =>
    Promise.resolve(
      new Response(
        JSON.stringify(
          String(url).includes("/api/badges")
            ? BADGES_PAYLOAD
            : {
                evolutionStage: 1,
                evolutionPath: "",
                side: null,
                collectedPaths: "[]",
                locked: 0,
                unlocked: 0,
                unlockedCount: 0,
                currentStreak: 0,
              },
        ),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    ),
  ) as unknown as typeof fetch;
}

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

// Issue #161: BadgesContent が単独で張っていた "badge-changes" チャンネルを共有チャンネルへ統合する。
describe("BadgesContent の Realtime は共有チャンネル（childRealtime）に統合されている", () => {
  afterEach(() => {
    cleanup(); // 共有チャンネルのリスナーを確実に全解除してテスト間の状態を残さない
  });

  it("BadgesContent を BottomNav / MonsterCutsceneListener / BadgeUnlockToast と同時に出してもチャンネルは1本", async () => {
    mockFetchWithBadges();
    render(
      <>
        <BottomNav />
        <MonsterCutsceneListener />
        <BadgeUnlockToast />
        <BadgesContent />
      </>,
    );

    expect(channelFactory).toHaveBeenCalledTimes(1);
  });

  it('"badge-changes" という名前のチャンネルは作られない', () => {
    mockFetchWithBadges();
    render(
      <>
        <BadgeUnlockToast />
        <BadgesContent />
      </>,
    );

    const names = channelFactory.mock.calls.map(([n]) => String(n));
    expect(names).not.toContain("badge-changes");
    expect(names).toHaveLength(1);
  });

  it("BadgesContent 単独でマウントしても共有チャンネルが開かれる（通知が届く）", () => {
    mockFetchWithBadges();
    render(<BadgesContent />);

    expect(channelFactory).toHaveBeenCalledTimes(1);
    expect(channelFactory.mock.calls[0][0]).not.toBe("badge-changes");
  });

  it("最後のリスナーが外れたときだけ removeChannel される", () => {
    mockFetchWithBadges();
    const toast = render(<BadgeUnlockToast />);
    const badges = render(<BadgesContent />);
    expect(channelFactory).toHaveBeenCalledTimes(1);

    badges.unmount();
    expect(removeChannelFn).not.toHaveBeenCalled(); // BadgeUnlockToast がまだ購読中

    toast.unmount();
    expect(removeChannelFn).toHaveBeenCalledTimes(1);
  });

  it("BadgesContent だけのとき、アンマウントでチャンネルが破棄される", () => {
    mockFetchWithBadges();
    const badges = render(<BadgesContent />);
    badges.unmount();
    expect(removeChannelFn).toHaveBeenCalledTimes(1);
  });

  it("enableRealtime=false の BadgesContent はチャンネルを開かない（親モード）", () => {
    mockFetchWithBadges();
    render(<BadgesContent fetchUrl="/api/parent/child-view/badges?childId=x" trackVisit={false} enableRealtime={false} />);
    expect(channelFactory).not.toHaveBeenCalled();
  });
});
