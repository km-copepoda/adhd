// @vitest-environment jsdom
import { render, screen, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// next/navigation: BottomNav の表示判定で usePathname を使うので mock
let mockPathname = "/app/child/quests";
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

// next/link を素の anchor に
vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

// Supabase Realtime: 何もしないスタブ
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    channel: () => ({
      on: function () { return this; },
      subscribe: function () { return this; },
    }),
    removeChannel: vi.fn(),
  }),
}));

// todayStringJST を固定
vi.mock("@/lib/date", () => ({
  todayStringJST: () => "2026-06-10",
}));

import StreakHeaderBadge from "@/components/child/StreakHeaderBadge";

type StreakRes = {
  currentStreak: number;
  bestStreak: number;
  monthlyDays: number;
  lastAchievedDate: string | null;
  currentTitle: { title: string; emoji: string } | null;
};

function mockStreakFetch(res: StreakRes) {
  global.fetch = vi.fn().mockImplementation((url: string) => {
    if (url.includes("/api/streak")) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(res) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  mockPathname = "/app/child/quests";
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("StreakHeaderBadge — 子レイアウト常駐の Duolingo ライク・ストリーク表示", () => {
  it("streak 0 のときは何も表示しない", async () => {
    mockStreakFetch({
      currentStreak: 0,
      bestStreak: 0,
      monthlyDays: 0,
      lastAchievedDate: null,
      currentTitle: null,
    });

    const { container } = await act(async () => render(<StreakHeaderBadge />));
    await waitFor(() => expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(0));

    // 念のため非同期反映を待つ
    await new Promise((r) => setTimeout(r, 30));
    expect(container.querySelector("a")).toBeNull();
  });

  it("今日達成済み（lastAchievedDate === today）なら active 表示で『今日まだ！』を出さない", async () => {
    mockStreakFetch({
      currentStreak: 7,
      bestStreak: 10,
      monthlyDays: 5,
      lastAchievedDate: "2026-06-10",
      currentTitle: null,
    });

    await act(async () => render(<StreakHeaderBadge />));

    await waitFor(() => {
      expect(screen.getByText("7")).toBeTruthy();
    });
    expect(screen.queryByText("今日まだ！")).toBeNull();
  });

  it("昨日達成（lastAchievedDate === yesterday）なら atRisk で『今日まだ！』を出す", async () => {
    mockStreakFetch({
      currentStreak: 5,
      bestStreak: 5,
      monthlyDays: 5,
      lastAchievedDate: "2026-06-09",
      currentTitle: null,
    });

    await act(async () => render(<StreakHeaderBadge />));

    await waitFor(() => {
      expect(screen.getByText("5")).toBeTruthy();
    });
    expect(screen.getByText("今日まだ！")).toBeTruthy();
  });

  it("一昨日以前（broken）でも streak 数値は表示する（警告は出さない）", async () => {
    mockStreakFetch({
      currentStreak: 3,
      bestStreak: 5,
      monthlyDays: 2,
      lastAchievedDate: "2026-06-08",
      currentTitle: null,
    });

    await act(async () => render(<StreakHeaderBadge />));

    await waitFor(() => {
      expect(screen.getByText("3")).toBeTruthy();
    });
    expect(screen.queryByText("今日まだ！")).toBeNull();
  });

  it("ログイン画面（/app/child/login）では非表示", async () => {
    mockPathname = "/app/child/login";
    mockStreakFetch({
      currentStreak: 7,
      bestStreak: 7,
      monthlyDays: 5,
      lastAchievedDate: "2026-06-10",
      currentTitle: null,
    });

    const { container } = await act(async () => render(<StreakHeaderBadge />));
    await new Promise((r) => setTimeout(r, 30));
    expect(container.querySelector("a")).toBeNull();
  });

  it("バッジは /app/child/monster へのリンクになっている", async () => {
    mockStreakFetch({
      currentStreak: 4,
      bestStreak: 4,
      monthlyDays: 4,
      lastAchievedDate: "2026-06-10",
      currentTitle: null,
    });

    await act(async () => render(<StreakHeaderBadge />));
    await waitFor(() => {
      expect(screen.getByText("4")).toBeTruthy();
    });
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe("/app/child/monster");
  });
});
