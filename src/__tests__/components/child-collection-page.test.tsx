// @vitest-environment jsdom
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/app/child/collection",
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    channel: () => ({
      on: function () { return this; },
      subscribe: () => ({}),
    }),
    removeChannel: vi.fn(),
  }),
}));

vi.mock("@/components/child/ZukanContent", () => ({
  default: () => <div data-testid="zukan-content">図鑑コンテンツ</div>,
}));

vi.mock("@/components/child/BadgesContent", () => ({
  default: () => <div data-testid="badges-content">実績コンテンツ</div>,
}));

vi.mock("@/components/child/ItemsContent", () => ({
  default: () => <div data-testid="items-content">アイテムコンテンツ</div>,
}));

import CollectionPage from "@/app/app/child/collection/page";

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({}),
  }) as unknown as typeof fetch;
});

describe("/app/child/collection ページ", () => {
  it("「📖 図鑑」「🎁 アイテム」「🏅 実績」の3タブを持つ", () => {
    render(<CollectionPage />);
    expect(screen.getByRole("button", { name: /図鑑/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /アイテム/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /実績/ })).toBeTruthy();
  });

  it("初期表示は図鑑タブ (ZukanContent が描画される)", () => {
    render(<CollectionPage />);
    expect(screen.getByTestId("zukan-content")).toBeTruthy();
    expect(screen.queryByTestId("badges-content")).toBeNull();
    expect(screen.queryByTestId("items-content")).toBeNull();
  });

  it("アイテムタブクリックで ItemsContent に切り替わる", () => {
    render(<CollectionPage />);
    fireEvent.click(screen.getByRole("button", { name: /アイテム/ }));
    expect(screen.getByTestId("items-content")).toBeTruthy();
    expect(screen.queryByTestId("zukan-content")).toBeNull();
  });

  it("実績タブクリックで BadgesContent に切り替わる", () => {
    render(<CollectionPage />);
    fireEvent.click(screen.getByRole("button", { name: /実績/ }));
    expect(screen.getByTestId("badges-content")).toBeTruthy();
    expect(screen.queryByTestId("zukan-content")).toBeNull();
  });
});
