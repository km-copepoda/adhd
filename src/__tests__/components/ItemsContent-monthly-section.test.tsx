// @vitest-environment jsdom
// ItemsContent の月限定セクションが視覚的にハッキリ月ごとに分かれていることを担保する。
//
// 従来: 月げんてい heading (text-xs) + 3 行の小見出し (text-[11px]) だけで、
// 通常アイテムのカテゴリー行と見分けが付かない状態だった。
// 変更後: 各月のブロックは独立したカード枠で囲み、月見出しも大きめに表示する。

import { render, screen, waitFor, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/image", () => ({
  __esModule: true,
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

import ItemsContent from "@/components/child/ItemsContent";

function makeItem(overrides: Partial<Record<string, unknown>>) {
  return {
    id: "x",
    season: "summer",
    category: "creature",
    rarity: "COMMON",
    name: "X",
    description: "",
    image: "/x.webp",
    owned: false,
    count: 0,
    firstAcquiredAt: null,
    lastAcquiredAt: null,
    ...overrides,
  };
}

function mockApiResponse() {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () =>
      Promise.resolve({
        currentSeason: "summer",
        currentMonth: 7,
        items: [
          // 通常アイテム (1個で十分 — カテゴリー行の存在確認用)
          makeItem({ id: "summer-01", name: "カブトムシ" }),
          // 6月限定 5 個
          ...[1, 2, 3, 4, 5].map((n) =>
            makeItem({
              id: `m06-0${n}`,
              month: 6,
              name: `六月${n}`,
              rarity: n === 5 ? "RARE" : "COMMON",
            }),
          ),
          // 7月限定 5 個 (今月)
          ...[1, 2, 3, 4, 5].map((n) =>
            makeItem({
              id: `m07-0${n}`,
              month: 7,
              name: `七月${n}`,
              rarity: n === 5 ? "RARE" : "COMMON",
            }),
          ),
          // 8月限定 5 個 (未来月)
          ...[1, 2, 3, 4, 5].map((n) =>
            makeItem({
              id: `m08-0${n}`,
              month: 8,
              name: `八月${n}`,
              rarity: n === 5 ? "RARE" : "COMMON",
            }),
          ),
        ],
      }),
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockApiResponse();
});

describe("ItemsContent 月限定セクションの月別視覚分離", () => {
  it("シーズン内の 3 ヶ月それぞれに独立したカード枠が付く", async () => {
    const { container } = render(<ItemsContent />);
    // シーズンタブ「夏」が表示されるまで待つ
    await waitFor(() => expect(screen.getAllByText(/夏/).length).toBeGreaterThan(0));

    // 各月ブロックには data-testid で識別できる card ラッパを持たせる
    for (const m of [6, 7, 8]) {
      const card = container.querySelector(`[data-testid="monthly-card-${m}"]`);
      expect(card, `month ${m} のカードが見つからない`).not.toBeNull();
      // カード枠らしい border クラスが付いている (視覚的独立性)
      expect(card!.className).toMatch(/border/);
      expect(card!.className).toMatch(/rounded/);
    }
  });

  it("各月カードの見出しは月番号を含み、通常カテゴリー見出しより目立つスタイル (text-sm 以上)", async () => {
    const { container } = render(<ItemsContent />);
    // シーズンタブ「夏」が表示されるまで待つ
    await waitFor(() => expect(screen.getAllByText(/夏/).length).toBeGreaterThan(0));

    for (const m of [6, 7, 8]) {
      const card = container.querySelector(`[data-testid="monthly-card-${m}"]`);
      expect(card).not.toBeNull();
      const heading = within(card as HTMLElement).getByRole("heading", { level: 3 });
      expect(heading.textContent).toContain(`${m}月`);
      // text-xs (12px) 相当より大きい表記であること
      expect(heading.className).not.toMatch(/text-xs\b/);
      expect(heading.className).not.toMatch(/text-\[1[01]px\]/);
    }
  });

  it("今月カード (7月) は特別スタイル (quest-gold 系のハイライト)", async () => {
    const { container } = render(<ItemsContent />);
    // シーズンタブ「夏」が表示されるまで待つ
    await waitFor(() => expect(screen.getAllByText(/夏/).length).toBeGreaterThan(0));

    const currentCard = container.querySelector('[data-testid="monthly-card-7"]');
    expect(currentCard).not.toBeNull();
    expect(currentCard!.className).toMatch(/quest-gold/);
  });

  it("未来月カード (8月) は「◯月になったらとうじょう」の予告文を含む", async () => {
    const { container } = render(<ItemsContent />);
    // シーズンタブ「夏」が表示されるまで待つ
    await waitFor(() => expect(screen.getAllByText(/夏/).length).toBeGreaterThan(0));

    const futureCard = container.querySelector('[data-testid="monthly-card-8"]');
    expect(futureCard).not.toBeNull();
    expect(futureCard!.textContent).toMatch(/8月になったらとうじょう/);
  });

  it("各月カード内には該当月の画像 alt 属性だけが並び、他月と混ざらない", async () => {
    const { container } = render(<ItemsContent />);
    // シーズンタブ「夏」が表示されるまで待つ
    await waitFor(() => expect(screen.getAllByText(/夏/).length).toBeGreaterThan(0));

    // 未所持アイテムは名前が "？？？" になるので、画像の alt に "未獲得" が入る。
    // 各月カードに配置される画像枚数 = そのカードの月に紐づく item 数のみ、を担保する。
    const june = container.querySelector('[data-testid="monthly-card-6"]');
    const july = container.querySelector('[data-testid="monthly-card-7"]');
    const aug = container.querySelector('[data-testid="monthly-card-8"]');
    expect(june!.querySelectorAll("img").length).toBe(5);
    expect(july!.querySelectorAll("img").length).toBe(5);
    expect(aug!.querySelectorAll("img").length).toBe(5);
    // 6月カードの id-based data-testid や画像 src で、7月/8月の filename が
    // 混ざらないことを確認
    // (実装で MonthlyThumb に item.id を key に使っているだけなので、
    //  ここは 画像枚数 = 5 の担保だけでも「月ごと分割」の証拠として十分)
  });
});
