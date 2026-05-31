// @vitest-environment jsdom
// コレクションタブのレア度バッジが ☆ 表記であることを担保する。
// (旧 "C / UC / R" 表記 → ★ × レア度段階)
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/image", () => ({
  __esModule: true,
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

import ItemsContent from "@/components/child/ItemsContent";

function mockApiResponse() {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () =>
      Promise.resolve({
        currentSeason: "summer",
        items: [
          {
            id: "summer-01", season: "summer", category: "creature", rarity: "COMMON",
            name: "カブトムシ", description: "夏の王様", image: "/x.webp",
            owned: true, count: 1, firstAcquiredAt: null, lastAcquiredAt: null,
          },
          {
            id: "summer-03", season: "summer", category: "creature", rarity: "UNCOMMON",
            name: "クラゲ", description: "海のランプ", image: "/x.webp",
            owned: true, count: 1, firstAcquiredAt: null, lastAcquiredAt: null,
          },
          {
            id: "summer-04", season: "summer", category: "creature", rarity: "RARE",
            name: "リュウグウノツカイ", description: "深海の伝説", image: "/x.webp",
            owned: true, count: 1, firstAcquiredAt: null, lastAcquiredAt: null,
          },
        ],
      }),
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockApiResponse();
});

describe("ItemsContent のレア度バッジ", () => {
  it("COMMON は ★ 1個", async () => {
    render(<ItemsContent />);
    await waitFor(() => expect(screen.getByText("カブトムシ")).toBeTruthy());
    // 旧 "C" / "UC" / "R" は登場しないこと
    expect(screen.queryByText(/^C$/)).toBeNull();
    expect(screen.queryByText(/^UC$/)).toBeNull();
    expect(screen.queryByText(/^R$/)).toBeNull();
    // カブトムシ (COMMON) 行に ★ が 1個
    expect(screen.getAllByText("★").length).toBeGreaterThanOrEqual(1);
  });

  it("UNCOMMON は ★★ 2個・RARE は ★★★ 3個", async () => {
    render(<ItemsContent />);
    await waitFor(() => expect(screen.getByText("リュウグウノツカイ")).toBeTruthy());
    expect(screen.getAllByText("★★").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("★★★").length).toBeGreaterThanOrEqual(1);
  });
});
