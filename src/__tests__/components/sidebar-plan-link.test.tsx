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

import Sidebar from "@/components/parent/Sidebar";

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({}),
  }) as unknown as typeof fetch;
});

/// Issue #148: 親向けプラン管理ページへの恒常導線 (PC向け Sidebar)
describe("親 Sidebar リンク: プラン管理", () => {
  it("「プラン」リンクが /app/parent/plan に向けて存在する", () => {
    render(<Sidebar />);
    const link = screen.getByRole("link", { name: /プラン/ });
    expect(link).toBeTruthy();
    expect(link.getAttribute("href")).toBe("/app/parent/plan");
  });

  it("既存の他リンク (ひろば) は引き続き存在する (回帰確認)", () => {
    render(<Sidebar />);
    const link = screen.getByRole("link", { name: /ひろば/ });
    expect(link.getAttribute("href")).toBe("/app/parent/gathering");
  });
});
