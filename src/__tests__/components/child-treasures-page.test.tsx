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

import ChildTreasuresPage from "@/app/app/child/treasures/page";

beforeEach(() => {
  global.fetch = vi.fn().mockImplementation((url: string) => {
    if (url.includes("/api/treasures/status")) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            locked: 2,
            unlocked: 3,
            opened: [
              {
                id: "log-1",
                openedAt: "2026-05-29T00:00:00Z",
                boosted: false,
                item: { id: "i1", title: "シール", rarity: "COMMON" },
              },
              {
                id: "log-2",
                openedAt: "2026-05-28T00:00:00Z",
                boosted: false,
                item: null,
              },
            ],
          }),
      });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  }) as unknown as typeof fetch;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("/app/child/treasures 宝箱専用画面", () => {
  it("ロック中／開封可の個数を表示する", async () => {
    await act(async () => {
      render(<ChildTreasuresPage />);
    });
    await waitFor(() => {
      expect(screen.getByText("承認まち")).toBeTruthy();
      expect(screen.getByText("あけられる")).toBeTruthy();
      // 数字も含まれていること（locked=2, unlocked=3）
      expect(screen.getAllByText("2").length).toBeGreaterThan(0);
      expect(screen.getAllByText("3").length).toBeGreaterThan(0);
    });
  });

  it("閉じた宝箱のドット絵を表示する", async () => {
    await act(async () => {
      render(<ChildTreasuresPage />);
    });
    await waitFor(() => {
      const imgs = screen.getAllByRole("img") as HTMLImageElement[];
      expect(imgs.some((i) => i.src.includes("/treasure/closed.png"))).toBe(true);
    });
  });

  it("「あける」ボタンを表示する", async () => {
    await act(async () => {
      render(<ChildTreasuresPage />);
    });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /あける/ })).toBeTruthy();
    });
  });

  it("開封履歴を表示する", async () => {
    await act(async () => {
      render(<ChildTreasuresPage />);
    });
    await waitFor(() => {
      expect(screen.getByText("シール")).toBeTruthy();
    });
  });

  it("「あける」を押すと window に 'treasure-changed' イベントを発火する（BottomNav バッジ更新トリガ）", async () => {
    // open API も応答するように fetch を上書き
    global.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("/api/treasures/status")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              locked: 0,
              unlocked: 1,
              opened: [],
            }),
        });
      }
      if (url.includes("/api/treasures/open") && init?.method === "POST") {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              pityTriggered: false,
              item: null,
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
            }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }) as unknown as typeof fetch;

    const handler = vi.fn();
    window.addEventListener("treasure-changed", handler);

    await act(async () => {
      render(<ChildTreasuresPage />);
    });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /あける/ })).toBeTruthy();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /あける/ }));
    });

    await waitFor(() => {
      expect(handler).toHaveBeenCalled();
    });

    window.removeEventListener("treasure-changed", handler);
  });
});
