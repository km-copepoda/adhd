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

describe("親 Sidebar リンク", () => {
  it("「ひろば」リンクが /app/parent/gathering に向けて存在する", () => {
    render(<Sidebar />);
    const link = screen.getByRole("link", { name: /ひろば/ });
    expect(link).toBeTruthy();
    expect(link.getAttribute("href")).toBe("/app/parent/gathering");
  });

  it("旧称「ギルド」「あつまり」はサイドバーに残っていない", () => {
    render(<Sidebar />);
    expect(screen.queryByText("ギルド")).toBeNull();
    expect(screen.queryByText("あつまり")).toBeNull();
  });

  it("サブタイトルに「ギルドマスター」が残っていない", () => {
    render(<Sidebar />);
    expect(screen.queryByText(/ギルドマスター/)).toBeNull();
  });
});
