// @vitest-environment jsdom
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/app/parent/records",
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

vi.mock("@/components/parent/CompletedContent", () => ({
  default: () => <div data-testid="completed-content">完了コンテンツ</div>,
}));

vi.mock("@/components/parent/HistoryContent", () => ({
  default: () => <div data-testid="history-content">履歴コンテンツ</div>,
}));

import RecordsPage from "@/app/app/parent/(app)/records/page";

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({}),
  }) as unknown as typeof fetch;
});

describe("/app/parent/records ページ (完了 + 履歴 統合)", () => {
  it("「今日」「過去」の2タブを持つ", () => {
    render(<RecordsPage />);
    expect(screen.getByRole("button", { name: /今日/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /過去/ })).toBeTruthy();
  });

  it("初期表示は今日タブ (CompletedContent が描画される)", () => {
    render(<RecordsPage />);
    expect(screen.getByTestId("completed-content")).toBeTruthy();
    expect(screen.queryByTestId("history-content")).toBeNull();
  });

  it("過去タブクリックで HistoryContent に切り替わる", () => {
    render(<RecordsPage />);
    fireEvent.click(screen.getByRole("button", { name: /過去/ }));
    expect(screen.getByTestId("history-content")).toBeTruthy();
    expect(screen.queryByTestId("completed-content")).toBeNull();
  });
});
