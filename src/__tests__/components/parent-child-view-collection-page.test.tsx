// @vitest-environment jsdom
import { render, screen, waitFor, act, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("next/image", () => ({
  __esModule: true,
  default: ({ src, alt }: { src: string; alt: string }) => (
    <img src={src} alt={alt} />
  ),
}));

vi.mock("@/components/LoadingSpinner", () => ({
  default: () => <div data-testid="loading-spinner" />,
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ childId: "child-1" }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    channel: () => ({
      on: () => ({ subscribe: () => ({}) }),
    }),
    removeChannel: () => {},
  }),
}));

import ParentChildViewCollectionPage from "@/app/app/parent/child-view/[childId]/collection/page";

const fetchSpy = vi.fn();

beforeEach(() => {
  fetchSpy.mockReset();
  global.fetch = fetchSpy as unknown as typeof fetch;
});

afterEach(() => {
  vi.restoreAllMocks();
  // 子供画面と localStorage を共有しないことを確認するため、毎回クリア
  localStorage.clear();
});

describe("/app/parent/child-view/[childId]/collection", () => {
  it("デフォルトで図鑑タブが表示され、childId 付きで /api/parent/child-view/monster を呼ぶ", async () => {
    fetchSpy.mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/parent/child-view/monster")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({
          side: "LIGHT",
          collectedPaths: '[]',
          monsterLevels: '{}',
          usedEggBonuses: '[]',
        }) });
      }
      if (typeof url === "string" && url.includes("/parent/child-view/badges")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({
          badges: [], unlockedCount: 0, totalCount: 1, newlyUnlocked: [],
        }) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    await act(async () => {
      render(<ParentChildViewCollectionPage />);
    });

    await waitFor(() => {
      const monsterCall = fetchSpy.mock.calls.find((c: any[]) =>
        typeof c[0] === "string" && c[0].includes("/parent/child-view/monster?childId=child-1"),
      );
      expect(monsterCall).toBeTruthy();
    });

    // 子画面用 API を絶対に呼ばないこと（親モードで子供セッションを混在させない）
    const childMonsterCall = fetchSpy.mock.calls.find((c: any[]) =>
      typeof c[0] === "string" && /^\/api\/monster\b/.test(c[0]),
    );
    expect(childMonsterCall).toBeFalsy();
  });

  it("「実績」タブをクリックすると /api/parent/child-view/badges を childId 付きで呼ぶ", async () => {
    fetchSpy.mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/parent/child-view/monster")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({
          side: "LIGHT", collectedPaths: '[]', monsterLevels: '{}', usedEggBonuses: '[]',
        }) });
      }
      if (typeof url === "string" && url.includes("/parent/child-view/badges")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({
          badges: [{ id: "first_step", name: "はじめの一歩", emoji: "🌱", description: "...", unlocked: true, unlockedAt: "2026-05-01", isNew: false }],
          unlockedCount: 1, totalCount: 1, newlyUnlocked: [],
        }) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    await act(async () => {
      render(<ParentChildViewCollectionPage />);
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /実績/ }));
    });

    await waitFor(() => {
      const badgesCall = fetchSpy.mock.calls.find((c: any[]) =>
        typeof c[0] === "string" && c[0].includes("/parent/child-view/badges?childId=child-1"),
      );
      expect(badgesCall).toBeTruthy();
    });

    // 子画面用 API を絶対に呼ばないこと
    const childBadgesCall = fetchSpy.mock.calls.find((c: any[]) =>
      typeof c[0] === "string" && /^\/api\/badges(\?|$)/.test(c[0]),
    );
    expect(childBadgesCall).toBeFalsy();
  });

  it("親モードでは localStorage の 'lastSeenCollectedCount' / 'lastSeenBadgeUnlockedCount' を書き換えない", async () => {
    fetchSpy.mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/parent/child-view/monster")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({
          side: "LIGHT",
          collectedPaths: '["STUDY","STAMINA","LIFE"]',
          monsterLevels: '{}',
          usedEggBonuses: '[]',
        }) });
      }
      if (typeof url === "string" && url.includes("/parent/child-view/badges")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({
          badges: [], unlockedCount: 5, totalCount: 10, newlyUnlocked: [],
        }) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    localStorage.setItem("lastSeenCollectedCount", "0");
    localStorage.setItem("lastSeenBadgeUnlockedCount", "0");

    await act(async () => {
      render(<ParentChildViewCollectionPage />);
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /実績/ }));
    });

    // 親モードでは更新しない（子供画面 BottomNav のバッジ既読化に影響させない）
    await waitFor(() => {
      expect(localStorage.getItem("lastSeenCollectedCount")).toBe("0");
      expect(localStorage.getItem("lastSeenBadgeUnlockedCount")).toBe("0");
    });
  });
});
