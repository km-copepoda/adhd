// @vitest-environment jsdom
import { render, screen, waitFor, act, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("next/image", () => ({
  __esModule: true,
  default: ({ src, alt }: { src: string; alt: string }) => (
    <img src={src} alt={alt} />
  ),
}));

import TreasureStock from "@/components/child/TreasureStock";

beforeEach(() => {
  global.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    if (url.includes("/api/treasures/status")) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            locked: 0,
            unlocked: 2,
            opened: [],
          }),
      });
    }
    if (url.includes("/api/treasures/open") && init?.method === "POST") {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
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
            remainingUnlocked: 1,
          }),
      });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  }) as unknown as typeof fetch;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("TreasureStock 開封イベント", () => {
  it("「あける」押下後 window に 'treasure-changed' イベントを発火する", async () => {
    const handler = vi.fn();
    window.addEventListener("treasure-changed", handler);

    await act(async () => {
      render(<TreasureStock />);
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

describe("TreasureStock variant", () => {
  it("variant 未指定で従来どおり描画される（回帰）", async () => {
    await act(async () => {
      render(<TreasureStock />);
    });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /あける/ })).toBeTruthy();
    });
    expect(screen.getByText("2").closest("span")).toBeTruthy();
  });

  it("variant='card' でも「あける」→ POST /api/treasures/open → カットイン表示 → treasure-changed dispatch が成立する", async () => {
    const handler = vi.fn();
    window.addEventListener("treasure-changed", handler);

    await act(async () => {
      render(<TreasureStock variant="card" />);
    });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /あける/ })).toBeTruthy();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /あける/ }));
    });

    await waitFor(() => {
      expect(handler).toHaveBeenCalled();
      // TreasureOpenCutscene が開封結果を表示している
      expect(screen.getByText("カブトムシ")).toBeTruthy();
    });

    window.removeEventListener("treasure-changed", handler);
  });

  it("variant='card' でも opening 中の連打で POST /api/treasures/open が2回呼ばれない", async () => {
    await act(async () => {
      render(<TreasureStock variant="card" />);
    });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /あける/ })).toBeTruthy();
    });

    const button = screen.getByRole("button", { name: /あける/ });
    await act(async () => {
      fireEvent.click(button);
      fireEvent.click(button);
      fireEvent.click(button);
    });

    await waitFor(() => {
      const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
      const openCalls = fetchMock.mock.calls.filter(
        ([url, init]: [string, RequestInit?]) =>
          typeof url === "string" &&
          url.includes("/api/treasures/open") &&
          init?.method === "POST",
      );
      expect(openCalls.length).toBe(1);
    });
  });

  it("境界値 locked=0 && unlocked=0 に至った後も数値行は出さないが、開封結果のカットインは描画される", async () => {
    global.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("/api/treasures/status")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ locked: 0, unlocked: 1, opened: [] }),
        });
      }
      if (url.includes("/api/treasures/open") && init?.method === "POST") {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
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
              // 開封後 locked=0 かつ unlocked=0 になる境界ケース
              remainingUnlocked: 0,
            }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }) as unknown as typeof fetch;

    await act(async () => {
      render(<TreasureStock variant="card" />);
    });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /あける/ })).toBeTruthy();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /あける/ }));
    });

    await waitFor(() => {
      // 開封結果カットインは描画される（locked=0/unlocked=0 でも result 表示は消えない）
      expect(screen.getByText("カブトムシ")).toBeTruthy();
      // 数値行（🔒/🔓 の在庫数表示）はもう出さない
      expect(screen.queryByRole("button", { name: /あける/ })).toBeNull();
    });
  });
});
