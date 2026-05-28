// @vitest-environment jsdom
import { render, waitFor, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "parent-1" } } }),
    },
  }),
}));

vi.mock("@/components/LoadingSpinner", () => ({
  default: () => React.createElement("div", { "data-testid": "spinner" }),
}));

import ParentTreasuresPage from "@/app/app/parent/(app)/treasures/page";

describe("親 ごほうび（宝箱）ページ: 家族メンバーの取得", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/api/family/code")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              code: "ABC123",
              members: [
                { id: "c1", name: "太郎", role: "CHILD" },
              ],
            }),
        });
      }
      if (url.includes("/api/treasures")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ items: [] }),
        });
      }
      // 想定外URLは404を返す（バグの再現用）
      return Promise.resolve({
        ok: false,
        status: 404,
        json: () => Promise.resolve({}),
      });
    });
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("家族メンバー取得には /api/family/code を呼ぶ（/api/family ではなく）", async () => {
    render(<ParentTreasuresPage />);

    await waitFor(() => {
      const urls = fetchMock.mock.calls.map((c) => String(c[0]));
      expect(urls.some((u) => u.includes("/api/family/code"))).toBe(true);
    });

    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    // 裸の /api/family（末尾が family のもの）を叩いていないこと
    expect(urls.some((u) => /\/api\/family(\?|$)/.test(u))).toBe(false);
  });

  it("子供の name が空でも monsterName を「対象の子供」セレクトに表示する", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/api/family/code")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              code: "ABC123",
              members: [
                // 実データ: 子供は monsterName のみ設定され name は null/空
                { id: "c1", name: null, monsterName: "りゅうくん", role: "CHILD" },
                { id: "c2", name: "", monsterName: "ねこさん", role: "CHILD" },
              ],
            }),
        });
      }
      if (url.includes("/api/treasures")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ items: [] }),
        });
      }
      return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
    });

    render(<ParentTreasuresPage />);

    await waitFor(() => {
      expect(screen.getByRole("option", { name: "りゅうくん" })).toBeDefined();
      expect(screen.getByRole("option", { name: "ねこさん" })).toBeDefined();
    });
  });
});
