// @vitest-environment jsdom
// 親 pending ページの「渡した」チェックトグル UI 動作。
// 子画面に露出しないことは API レベルで担保 (fulfill route が PARENT のみ受理)。
import { render, screen, waitFor, act, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/components/parent/ParentTreasureTabs", () => ({
  default: () => null,
}));

import ParentTreasureHistoryPage from "@/app/app/parent/(app)/treasures/pending/page";

function setupFetch(opts: {
  items: Array<{
    id: string;
    openedAt: string;
    item: { id: string; title: string; rarity: "COMMON" | "UNCOMMON" | "RARE" } | null;
    child: { id: string; name: string | null; monsterName: string | null };
    fulfilled: boolean;
  }>;
  onFulfill?: (id: string, fulfilled: boolean) => void;
}) {
  const fetchSpy = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    if (typeof url === "string" && url.includes("/api/treasures/pending")) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ items: opts.items }) });
    }
    const m = typeof url === "string" && url.match(/\/api\/treasures\/fulfill\/([^/]+)/);
    if (m && init?.method === "POST") {
      const body = JSON.parse(init.body as string) as { fulfilled: boolean };
      opts.onFulfill?.(m[1], body.fulfilled);
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ ok: true, id: m[1], fulfilled: body.fulfilled }),
      });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });
  global.fetch = fetchSpy as unknown as typeof fetch;
  return fetchSpy;
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const sampleItem = {
  id: "t1",
  openedAt: new Date().toISOString(),
  item: { id: "i1", title: "おやつ", rarity: "COMMON" as const },
  child: { id: "c1", name: "太郎", monsterName: "ドラゴン" },
  fulfilled: false,
};

describe("親 pending ページ — 渡したチェック", () => {
  it("未チェック (fulfilled=false) の行に「まだ渡してない」表示が出る", async () => {
    setupFetch({ items: [sampleItem] });
    await act(async () => {
      render(<ParentTreasureHistoryPage />);
    });
    await waitFor(() => expect(screen.getByText("おやつ")).toBeTruthy());
    expect(screen.getByText(/まだ渡してない/)).toBeTruthy();
  });

  it("チェック済 (fulfilled=true) の行に「渡し済み」表示が出る", async () => {
    setupFetch({ items: [{ ...sampleItem, fulfilled: true }] });
    await act(async () => {
      render(<ParentTreasureHistoryPage />);
    });
    await waitFor(() => expect(screen.getByText("おやつ")).toBeTruthy());
    expect(screen.getByText(/渡し済み/)).toBeTruthy();
  });

  it("ボタンを押すと fulfill API を呼び出し、UI が「渡し済み」表示に切り替わる", async () => {
    const onFulfill = vi.fn();
    setupFetch({ items: [sampleItem], onFulfill });
    await act(async () => {
      render(<ParentTreasureHistoryPage />);
    });
    await waitFor(() => expect(screen.getByText("おやつ")).toBeTruthy());

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /渡した/ }));
    });

    await waitFor(() => {
      expect(onFulfill).toHaveBeenCalledWith("t1", true);
    });
    await waitFor(() => expect(screen.getByText(/渡し済み/)).toBeTruthy());
  });

  it("渡し済みボタンを再度押すと fulfilled=false で取り消し", async () => {
    const onFulfill = vi.fn();
    setupFetch({ items: [{ ...sampleItem, fulfilled: true }], onFulfill });
    await act(async () => {
      render(<ParentTreasureHistoryPage />);
    });
    await waitFor(() => expect(screen.getByText("おやつ")).toBeTruthy());

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /取り消し/ }));
    });

    await waitFor(() => {
      expect(onFulfill).toHaveBeenCalledWith("t1", false);
    });
  });
});
