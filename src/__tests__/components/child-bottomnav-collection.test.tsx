// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/app/child/quests",
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

import BottomNav from "@/components/child/BottomNav";

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({}),
  }) as unknown as typeof fetch;
});

describe("子 BottomNav コレクション統合", () => {
  it("「コレクション」タブが存在する", () => {
    render(<BottomNav />);
    expect(screen.getByText("コレクション")).toBeTruthy();
  });

  it("コレクションタブは /app/child/collection にリンクする", () => {
    render(<BottomNav />);
    const link = screen.getByText("コレクション").closest("a") as HTMLAnchorElement;
    expect(link).toBeTruthy();
    expect(link.getAttribute("href")).toBe("/app/child/collection");
  });

  it("旧「図鑑」タブは独立タブとして存在しない（コレクション内に統合）", () => {
    render(<BottomNav />);
    expect(screen.queryByText("図鑑")).toBeNull();
  });

  it("旧「実績」タブは独立タブとして存在しない（コレクション内に統合）", () => {
    render(<BottomNav />);
    expect(screen.queryByText("実績")).toBeNull();
  });

  it("ログアウトボタンは引き続き存在する（移動先未確定のため当面残置）", () => {
    render(<BottomNav />);
    expect(screen.getByText("ログアウト")).toBeTruthy();
  });
});
