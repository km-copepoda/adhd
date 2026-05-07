// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";

// --- mocks ---

vi.mock("next/navigation", () => ({
  usePathname: () => "/app/child/quests",
}));

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) =>
    React.createElement("a", { href, className }, children),
}));

const mockSignOut = vi.fn().mockResolvedValue({});

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { signOut: mockSignOut },
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
    })),
    removeChannel: vi.fn(),
  }),
}));

vi.mock("@/hooks/usePendingApprovalCount", () => ({
  usePendingCounts: () => ({ tasks: 0, approvals: 0 }),
}));

vi.mock("@/components/parent/PushSubscriber", () => ({
  default: ({ className }: { className?: string }) =>
    React.createElement("button", { className }, "通知"),
}));

vi.mock("@/lib/bottom-nav", () => ({
  shouldShowBottomNav: () => true,
}));

vi.mock("@/lib/streakMilestones", () => ({
  shouldShowMonsterBadge: () => false,
  shouldShowZukanBadge: () => false,
  getUnreadAchievements: () => [],
  getNewBadgeCount: () => 0,
  STREAK_MILESTONES: [],
}));

vi.mock("@/lib/questProgress", () => ({
  computeRemainingCount: () => 0,
}));

global.fetch = vi.fn().mockResolvedValue({
  json: () => Promise.resolve([]),
} as unknown as Response);

import Sidebar from "@/components/parent/Sidebar";
import ParentBottomNav from "@/components/parent/ParentBottomNav";
import BottomNav from "@/components/child/BottomNav";

// --- tests ---

describe("ログアウト後のリダイレクト先", () => {
  beforeEach(() => {
    vi.stubGlobal("location", { href: "" });
    mockSignOut.mockResolvedValue({});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("親 Sidebar: ログアウト後に /login にリダイレクトする", async () => {
    render(<Sidebar />);
    const btn = screen.getByText("ログアウト").closest("button")!;
    fireEvent.click(btn);
    await waitFor(() => {
      expect((window.location as unknown as { href: string }).href).toBe("/login");
    });
  });

  it("親 ParentBottomNav: ログアウト後に /login にリダイレクトする", async () => {
    render(<ParentBottomNav />);
    const btn = screen.getByText("ログアウト").closest("button")!;
    fireEvent.click(btn);
    await waitFor(() => {
      expect((window.location as unknown as { href: string }).href).toBe("/login");
    });
  });

  it("子 BottomNav: 確認ダイアログでOKを押すと /login にリダイレクトする", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<BottomNav />);
    const btn = screen.getByText("ログアウト").closest("button")!;
    fireEvent.click(btn);
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalledTimes(1);
      expect((window.location as unknown as { href: string }).href).toBe("/login");
    });
    confirmSpy.mockRestore();
  });
});

describe("子 BottomNav: 誤タップ防止の確認ダイアログ", () => {
  beforeEach(() => {
    vi.stubGlobal("location", { href: "" });
    mockSignOut.mockResolvedValue({});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("確認ダイアログでキャンセルした場合、signOut もリダイレクトもしない", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<BottomNav />);
    const btn = screen.getByText("ログアウト").closest("button")!;
    fireEvent.click(btn);
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    // キャンセル時はsignOutを呼ばない
    expect(mockSignOut).not.toHaveBeenCalled();
    // 念のため、非同期処理を待ってもリダイレクトしないことを確認
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect((window.location as unknown as { href: string }).href).toBe("");
    confirmSpy.mockRestore();
  });

  it("ログアウトボタン押下時にconfirmが呼ばれる（メッセージ確認）", () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<BottomNav />);
    const btn = screen.getByText("ログアウト").closest("button")!;
    fireEvent.click(btn);
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    // 子供向けの分かりやすいメッセージであること（"ログアウト" の文字を含む）
    const message = String(confirmSpy.mock.calls[0][0]);
    expect(message).toContain("ログアウト");
    confirmSpy.mockRestore();
  });
});
