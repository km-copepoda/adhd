// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/login",
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signOut: vi.fn().mockResolvedValue({}),
      signInWithPassword: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      signUp: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    },
  }),
}));

vi.mock("@/components/InstallPrompt", () => ({
  default: () => <div data-testid="install-prompt" />,
}));

import LoginSelectionPage from "@/app/login/page";
import ParentLoginPage from "@/app/app/parent/login/page";
import RegisterPage from "@/app/app/(auth)/register/page";

describe("「管理者」表記（旧ギルドマスター）", () => {
  it("ログイン選択画面: 親リンクに「管理者」が含まれ「ギルドマスター」は出ない", () => {
    render(<LoginSelectionPage />);
    const link = screen.getByRole("link", { name: /管理者/ });
    expect(link).toBeTruthy();
    expect(link.getAttribute("href")).toBe("/app/parent/login");
    expect(screen.queryByText(/ギルドマスター/)).toBeNull();
  });

  it("親ログイン画面: サブタイトルが「管理者 ログイン」", () => {
    render(<ParentLoginPage />);
    expect(screen.getByText("管理者 ログイン")).toBeTruthy();
    expect(screen.queryByText(/ギルドマスター/)).toBeNull();
  });

  it("親アカウント作成画面: サブタイトルが「管理者 アカウント作成」", () => {
    render(<RegisterPage />);
    expect(screen.getByText("管理者 アカウント作成")).toBeTruthy();
    expect(screen.queryByText(/ギルドマスター/)).toBeNull();
  });
});
