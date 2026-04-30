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
import BottomNav from "@/components/child/BottomNav";

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({}),
  }) as unknown as typeof fetch;
});

describe("BottomNav ラベル", () => {
  it("親 BottomNav に「ギルド」が含まれる（旧あつまり）", () => {
    render(<ParentBottomNav />);
    expect(screen.getByText("ギルド")).toBeTruthy();
    expect(screen.queryByText("あつまり")).toBeNull();
  });

  it("子 BottomNav に「ギルド」が含まれる（旧あつまり）", () => {
    vi.doMock("next/navigation", () => ({
      usePathname: () => "/app/child/quests",
    }));
    render(<BottomNav />);
    expect(screen.getByText("ギルド")).toBeTruthy();
    expect(screen.queryByText("あつまり")).toBeNull();
  });
});
