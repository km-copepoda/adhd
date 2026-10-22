// @vitest-environment jsdom
// 親ナビのリンクは prefetch しない。アプリ起動時に全ページの先読みが同時に走ると、
// ミドルウェアの認証（トークン更新）が並列に衝突し、白画面やログイン画面への
// 誤リダイレクトの原因になっていた（2026-10-22 本番ログ）。
import { render } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";

vi.mock("next/link", () => ({
  default: ({ href, prefetch, children, ...rest }: { href: string; prefetch?: boolean; children: React.ReactNode }) =>
    React.createElement("a", { href, "data-prefetch": String(prefetch), ...rest }, children),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/app/parent/tasks",
}));

vi.mock("@/hooks/usePendingApprovalCount", () => ({
  usePendingCounts: () => ({ tasks: 0, approvals: 0 }),
}));

vi.mock("@/components/parent/PushSubscriber", () => ({
  default: () => <div />,
}));

import Sidebar from "@/components/parent/Sidebar";
import ParentBottomNav from "@/components/parent/ParentBottomNav";

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({}),
  }) as unknown as typeof fetch;
});

describe("親ナビのリンクは prefetch しない", () => {
  it.each([
    ["Sidebar", Sidebar],
    ["ParentBottomNav", ParentBottomNav],
  ])("%s の全リンクが prefetch={false}", (_name, Component) => {
    const { container } = render(<Component />);
    const links = Array.from(container.querySelectorAll("a[href^='/app/parent']"));
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link.getAttribute("data-prefetch")).toBe("false");
    }
  });
});
