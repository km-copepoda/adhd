// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";

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

vi.mock("next/image", () => ({
  default: ({ alt }: { alt?: string }) => React.createElement("img", { alt }),
}));

vi.mock("@/components/LoadingSpinner", () => ({
  default: () => React.createElement("div", { "data-testid": "spinner" }),
}));

import FamilyPage from "@/app/app/parent/(app)/family/page";

describe("親 ファミリーページ: ログアウトボタン", () => {
  beforeEach(() => {
    vi.stubGlobal("location", { href: "" });
    mockSignOut.mockClear();
    mockSignOut.mockResolvedValue({});
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/api/family/code")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              code: "ABC123",
              members: [],
            }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("ファミリーページにログアウトボタンが表示される", async () => {
    render(<FamilyPage />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /ログアウト/ })).toBeTruthy();
    });
  });

  it("ログアウトボタンを押すと signOut が呼ばれ /login にリダイレクトする", async () => {
    render(<FamilyPage />);
    const btn = await waitFor(() =>
      screen.getByRole("button", { name: /ログアウト/ })
    );
    fireEvent.click(btn);
    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalledTimes(1);
      expect((window.location as unknown as { href: string }).href).toBe(
        "/login"
      );
    });
  });
});
