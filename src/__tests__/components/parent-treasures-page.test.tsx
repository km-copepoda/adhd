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
          json: () => Promise.resolve({ items: [], plan: "PREMIUM" }),
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

  it("親が代理で報告した場合も宝箱が出る旨の案内文が表示される（2026-05-30 仕様変更後）", async () => {
    render(<ParentTreasuresPage />);
    await waitFor(() => {
      const body = document.body.textContent ?? "";
      expect(body).toMatch(/代理/);
      expect(body).toMatch(/宝箱|ごほうび/);
      expect(body).toMatch(/出ます|生成|もらえ/);
      // 旧仕様の「出ません/出ない/対象外」は残っていないこと
      expect(body).not.toMatch(/宝箱が出ません/);
      expect(body).not.toMatch(/宝箱（ごほうび）は出ません/);
    });
  });

  it("子供の name が空でも monsterName を子供切替ボタンに表示する", async () => {
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
          json: () => Promise.resolve({ items: [], plan: "PREMIUM" }),
        });
      }
      return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
    });

    render(<ParentTreasuresPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /りゅうくん/ })).toBeDefined();
      expect(screen.getByRole("button", { name: /ねこさん/ })).toBeDefined();
    });
  });

  it("子供が複数いる場合、画面上部に子供アイコンの切替ボタンが表示され、select は使わない", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/api/family/code")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              code: "ABC123",
              members: [
                { id: "c1", name: "太郎", monsterName: "ドラゴン", role: "CHILD" },
                { id: "c2", name: "花子", monsterName: "ユニコーン", role: "CHILD" },
              ],
            }),
        });
      }
      if (url.includes("/api/treasures")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ items: [], plan: "PREMIUM" }),
        });
      }
      return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
    });

    render(<ParentTreasuresPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /ドラゴン/ })).toBeDefined();
      expect(screen.getByRole("button", { name: /ユニコーン/ })).toBeDefined();
    });
    // 「対象の子供」セレクトは廃止
    expect(screen.queryByText("対象の子供")).toBeNull();
  });
});

// ─── プランによる「おすすめセットで始める」ボタンの表示制御 (Issue #76) ──
// 背景: TREASURE_TEMPLATES は20件だが FREE プランの treasure_item 上限は5件。
// import API は「全部か0か」判定 (checkBulkLimit) のため FREE では必ず403になる。
// ボタン自体をクライアント側で隠す/無効化することで403に遭遇させない。
describe("親 ごほうび（宝箱）ページ: プランによるおすすめセットボタンの表示制御", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  function mockFetchWithPlan(plan: "FREE" | "PREMIUM") {
    fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/api/family/code")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              code: "ABC123",
              members: [{ id: "c1", name: "太郎", role: "CHILD" }],
            }),
        });
      }
      if (url.includes("/api/treasures")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ items: [], plan }),
        });
      }
      return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
    });
    global.fetch = fetchMock as unknown as typeof fetch;
  }

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("PREMIUM かつ items が0件の場合、おすすめセットで始めるボタンが表示される", async () => {
    mockFetchWithPlan("PREMIUM");
    render(<ParentTreasuresPage />);

    await waitFor(() => {
      const body = document.body.textContent ?? "";
      expect(body).toMatch(/まだごほうびが登録されていません/);
    });

    const button = screen.getByRole("button", { name: /おすすめセットで始める/ });
    expect(button).toBeDefined();
    expect((button as HTMLButtonElement).disabled).toBe(false);
  });

  it("FREE かつ items が0件の場合、おすすめセットで始めるボタンが表示されない、または無効化されている", async () => {
    mockFetchWithPlan("FREE");
    render(<ParentTreasuresPage />);

    await waitFor(() => {
      const body = document.body.textContent ?? "";
      expect(body).toMatch(/まだごほうびが登録されていません/);
    });

    const button = screen.queryByRole("button", { name: /おすすめセットで始める/ });
    if (button === null) {
      // 非表示（推奨）
      expect(button).toBeNull();
    } else {
      // 無効化されている場合も許容
      expect((button as HTMLButtonElement).disabled).toBe(true);
    }
  });
});
