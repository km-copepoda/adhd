// @vitest-environment jsdom
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { signOut: vi.fn() },
  }),
}));

vi.mock("@/components/LoadingSpinner", () => ({
  default: () => <div data-testid="spinner" />,
}));

vi.mock("@/components/parent/MonsterThemeSelector", () => ({
  default: () => <div />,
}));

import FamilyPage from "@/app/app/parent/(app)/family/page";

/// Issue #148 Q1(B): 子アカウント上限到達時、既存のインラインエラー表示は維持したまま、
/// その直下に「プラン管理を見る」リンクを追加する。既存 E2E (s26) をほぼ無改変で
/// 維持するため、確認ダイアログ等への置き換えは行わない。
describe("親 ファミリー管理ページ: プラン管理への導線 (Q1 B案)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("/api/family/code")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ code: "ABC123", members: [] }),
        });
      }
      if (url.includes("/api/family/members") && init?.method === "POST") {
        return Promise.resolve({
          ok: false,
          status: 403,
          json: () =>
            Promise.resolve({
              error: "無料プランでは子アカウントは1人までです。プレミアムプランで無制限になります。",
              code: "PLAN_LIMIT_EXCEEDED",
              resource: "child",
            }),
        });
      }
      return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
    });
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("子アカウント上限で追加に失敗すると、既存のインラインエラー文言が表示される (回帰: confirm/alertに置き換えない)", async () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    const confirmSpy = vi.spyOn(window, "confirm").mockImplementation(() => false);

    render(<FamilyPage />);
    await waitFor(() => expect(screen.queryByTestId("spinner")).toBeNull());

    fireEvent.click(screen.getByRole("button", { name: /子どもを追加/ }));
    fireEvent.change(screen.getByPlaceholderText("例: りゅうくん"), {
      target: { value: "じろう" },
    });
    fireEvent.click(screen.getByRole("button", { name: "追加" }));

    await waitFor(() => {
      expect(
        screen.getByText(/無料プランでは子アカウントは1人までです/),
      ).toBeTruthy();
    });

    // インラインエラーのままであり、confirm/alert のダイアログには置き換わっていない
    expect(alertSpy).not.toHaveBeenCalled();
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it("子アカウント上限のインラインエラー直下に「プラン管理を見る」リンクが表示される (Q2 B案)", async () => {
    render(<FamilyPage />);
    await waitFor(() => expect(screen.queryByTestId("spinner")).toBeNull());

    fireEvent.click(screen.getByRole("button", { name: /子どもを追加/ }));
    fireEvent.change(screen.getByPlaceholderText("例: りゅうくん"), {
      target: { value: "じろう" },
    });
    fireEvent.click(screen.getByRole("button", { name: "追加" }));

    await waitFor(() => {
      const link = screen.getByRole("link", { name: /プラン管理を見る/ });
      expect(link.getAttribute("href")).toBe("/app/parent/plan");
    });
  });
});
