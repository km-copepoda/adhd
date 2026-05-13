// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/app/parent/tasks",
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

vi.mock("@/hooks/usePendingApprovalCount", () => ({
  usePendingCounts: () => ({ tasks: 0, approvals: 0 }),
}));

vi.mock("@/components/parent/PushSubscriber", () => ({
  default: () => <div />,
}));

import ParentBottomNav from "@/components/parent/ParentBottomNav";
import Sidebar from "@/components/parent/Sidebar";

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({}),
  }) as unknown as typeof fetch;
});

describe("子供モードへの導線", () => {
  it("モバイル底部ナビ（ParentBottomNav）に「子供モード」リンクがある", () => {
    render(<ParentBottomNav />);
    const link = screen.getByRole("link", { name: /子供モード/ });
    expect(link).toBeTruthy();
    expect(link.getAttribute("href")).toBe("/app/parent/child-view");
  });

  it("デスクトップ Sidebar に「子供モード」リンクがある", () => {
    render(<Sidebar />);
    const link = screen.getByRole("link", { name: /子供モード/ });
    expect(link).toBeTruthy();
    expect(link.getAttribute("href")).toBe("/app/parent/child-view");
  });
});
