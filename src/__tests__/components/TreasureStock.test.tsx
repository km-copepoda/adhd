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
