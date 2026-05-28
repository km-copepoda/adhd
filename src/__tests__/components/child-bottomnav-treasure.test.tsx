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

describe("子 BottomNav 宝箱タブ", () => {
  it("「宝箱」ラベルのタブが存在する", () => {
    render(<BottomNav />);
    expect(screen.getByText("宝箱")).toBeTruthy();
  });

  it("宝箱タブは /app/child/treasures にリンクする", () => {
    render(<BottomNav />);
    const link = screen.getByText("宝箱").closest("a") as HTMLAnchorElement;
    expect(link).toBeTruthy();
    expect(link.getAttribute("href")).toBe("/app/child/treasures");
  });
});
