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

describe("親ナビ: 完了 + 履歴 → 記録 タブ統合", () => {
  describe("ParentBottomNav", () => {
    it("「記録」リンクが /app/parent/records に向けて存在する", () => {
      render(<ParentBottomNav />);
      const link = screen.getByRole("link", { name: /記録/ });
      expect(link).toBeTruthy();
      expect(link.getAttribute("href")).toBe("/app/parent/records");
    });

    it("旧「完了」「履歴」の独立リンクは底部ナビに存在しない", () => {
      render(<ParentBottomNav />);
      const labels = Array.from(document.querySelectorAll("a span"))
        .map((el) => el.textContent ?? "");
      expect(labels).not.toContain("完了");
      expect(labels).not.toContain("履歴");
      expect(screen.queryByRole("link", { name: /^✅ 承認$/ })).toBeNull();
    });
  });

  describe("Sidebar", () => {
    it("「記録」リンクが /app/parent/records に向けて存在する", () => {
      render(<Sidebar />);
      const link = screen.getByRole("link", { name: /記録/ });
      expect(link).toBeTruthy();
      expect(link.getAttribute("href")).toBe("/app/parent/records");
    });

    it("旧「今日の完了」「過去の記録」リンクはサイドバーに存在しない", () => {
      render(<Sidebar />);
      expect(screen.queryByRole("link", { name: /今日の完了/ })).toBeNull();
      expect(screen.queryByRole("link", { name: /過去の記録/ })).toBeNull();
    });
  });
});
