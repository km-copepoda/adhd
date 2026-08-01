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
  // 今日獲得 + 過去獲得 + 未獲得 のサンプル
  const todayIso = new Date().toISOString();
  const yesterdayIso = new Date(Date.now() - 36 * 3600 * 1000).toISOString();
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () =>
      Promise.resolve({
        currentSeason: "summer",
        currentMonth: 7,
        items: [
          {
            id: "summer-01", season: "summer", category: "creature", rarity: "COMMON",
            name: "カブトムシ", description: "夏の王様", image: "/x.webp",
            owned: true, count: 1, firstAcquiredAt: todayIso, lastAcquiredAt: todayIso,
          },
          {
            id: "summer-03", season: "summer", category: "creature", rarity: "UNCOMMON",
            name: "クラゲ", description: "海のランプ", image: "/x.webp",
            owned: true, count: 1, firstAcquiredAt: yesterdayIso, lastAcquiredAt: yesterdayIso,
          },
          {
            id: "summer-04", season: "summer", category: "creature", rarity: "RARE",
            name: "リュウグウノツカイ", description: "深海の伝説", image: "/x.webp",
            owned: true, count: 1, firstAcquiredAt: todayIso, lastAcquiredAt: todayIso,
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

  it("今日獲得したアイテムには NEW バッジが付く (過去獲得には付かない)", async () => {
    render(<ItemsContent />);
    await waitFor(() => expect(screen.getByText("カブトムシ")).toBeTruthy());
    // カブトムシ (今日) と リュウグウノツカイ (今日) で 2 つ NEW が出る
    const news = screen.getAllByText("NEW");
    expect(news.length).toBe(2);
  });
});
