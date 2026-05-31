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

import ParentChildViewTreasuresPage from "@/app/app/parent/child-view/[childId]/treasures/page";

const fetchSpy = vi.fn();

beforeEach(() => {
  fetchSpy.mockReset();
  global.fetch = fetchSpy as unknown as typeof fetch;
});

afterEach(() => {
  vi.restoreAllMocks();
});

const statusResponse = {
  locked: 2,
  unlocked: 3,
  hasPool: true,
  opened: [
    {
      id: "log-1",
      openedAt: "2026-05-29T00:00:00Z",
      boosted: false,
      item: { id: "i1", title: "シール", rarity: "COMMON" },
    },
  ],
};

describe("/app/parent/child-view/[childId]/treasures", () => {
  it("子供の childId 付きで /api/parent/child-view/treasures/status を呼ぶ", async () => {
    fetchSpy.mockResolvedValue({ ok: true, json: () => Promise.resolve(statusResponse) });

    await act(async () => {
      render(<ParentChildViewTreasuresPage />);
    });

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining("/api/parent/child-view/treasures/status?childId=child-1"),
        expect.any(Object),
      );
    });
  });

  it("ロック中／開封可の個数と開封履歴を表示する", async () => {
    fetchSpy.mockResolvedValue({ ok: true, json: () => Promise.resolve(statusResponse) });

    await act(async () => {
      render(<ParentChildViewTreasuresPage />);
    });

    await waitFor(() => {
      expect(screen.getByText("承認まち")).toBeTruthy();
      expect(screen.getByText("あけられる")).toBeTruthy();
      expect(screen.getByText("シール")).toBeTruthy();
    });
  });

  it("「あける」ボタンを押すと /api/parent/child-view/treasures/open に childId つきで POST する", async () => {
    fetchSpy.mockImplementation((url: string, init?: RequestInit) => {
      if (typeof url === "string" && url.includes("/treasures/status")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({
          locked: 0, unlocked: 1, hasPool: true, opened: [],
        }) });
      }
      if (typeof url === "string" && url.includes("/treasures/open") && init?.method === "POST") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({
          ok: true, pityTriggered: false,
          item: { id: "i1", title: "あめ", rarity: "COMMON" },
          collectionItem: null,
          remainingUnlocked: 0,
        }) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    await act(async () => {
      render(<ParentChildViewTreasuresPage />);
    });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /あける/ })).toBeTruthy();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /あける/ }));
    });

    await waitFor(() => {
      const openCall = fetchSpy.mock.calls.find((c: any[]) =>
        typeof c[0] === "string" && c[0].includes("/treasures/open"),
      );
      expect(openCall).toBeTruthy();
      expect(openCall![1].method).toBe("POST");
      const body = JSON.parse(openCall![1].body as string);
      expect(body.childId).toBe("child-1");
    });
  });

  it("「あける」を押しても window に 'treasure-changed' イベントを発火しない（親モードでは子供 BottomNav に影響させない）", async () => {
    fetchSpy.mockImplementation((url: string, init?: RequestInit) => {
      if (typeof url === "string" && url.includes("/treasures/status")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({
          locked: 0, unlocked: 1, hasPool: true, opened: [],
        }) });
      }
      if (typeof url === "string" && url.includes("/treasures/open") && init?.method === "POST") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({
          ok: true, pityTriggered: false, item: null,
          collectionItem: {
            id: "summer-01",
            name: "カブトムシ",
            rarity: "COMMON",
            season: "summer",
            description: "夏の王様",
            image: "/collection-items/summer/カブトムシ.png",
            count: 1,
          },
          remainingUnlocked: 0,
        }) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    const handler = vi.fn();
    window.addEventListener("treasure-changed", handler);

    await act(async () => {
      render(<ParentChildViewTreasuresPage />);
    });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /あける/ })).toBeTruthy();
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /あける/ }));
    });

    // 数フレーム待つ
    await new Promise((r) => setTimeout(r, 30));
    expect(handler).not.toHaveBeenCalled();
    window.removeEventListener("treasure-changed", handler);
  });
});
