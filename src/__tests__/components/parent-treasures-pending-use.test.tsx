// @vitest-environment jsdom
// #164: 親 pending ページで、親が承認なしで直接「つかった」にできる UI。
//  - UNUSED / USE_REQUESTED の行にだけ「つかった」ボタン（USED・保持期間外には出さない）
//  - 押下で確認モーダル（role=dialog）→「使用済みにする」で POST /api/treasures/use/[id]
//  - 楽観更新。失敗時は「操作前の useStatus / fulfilled」に戻す（申請中表示を失わない）
import { render, screen, waitFor, act, fireEvent, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/components/parent/ParentTreasureTabs", () => ({
  default: () => null,
}));

import ParentTreasureHistoryPage from "@/app/app/parent/(app)/treasures/pending/page";

type TreasureUseStatus = "UNUSED" | "USE_REQUESTED" | "USED";

interface Row {
  id: string;
  openedAt: string;
  item: { id: string; title: string; rarity: "COMMON" | "UNCOMMON" | "RARE" } | null;
  child: { id: string; name: string | null; monsterName: string | null };
  fulfilled: boolean;
  useStatus?: TreasureUseStatus;
  visibleToChild?: boolean;
}

const sampleItem: Row = {
  id: "t1",
  openedAt: new Date().toISOString(),
  item: { id: "i1", title: "おやつ", rarity: "COMMON" },
  child: { id: "c1", name: "太郎", monsterName: "ドラゴン" },
  fulfilled: false,
  useStatus: "UNUSED",
};

function setupFetch(opts: {
  items: Row[];
  useOk?: boolean;
  useThrows?: boolean;
  onUse?: (id: string, init?: RequestInit) => void;
}) {
  // サーバ状態を模す（成功時のみ USED に更新し、再取得でも反映される）
  const server = opts.items.map((i) => ({ ...i }));
  const fetchSpy = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    if (typeof url === "string" && url.includes("/api/treasures/pending")) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ items: server }) });
    }
    if (typeof url === "string" && url.includes("/api/family/code")) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ members: [] }) });
    }
    const m = typeof url === "string" && url.match(/\/api\/treasures\/use\/([^/]+)/);
    if (m && init?.method === "POST") {
      opts.onUse?.(m[1], init);
      if (opts.useThrows) return Promise.reject(new Error("network"));
      if (opts.useOk === false) {
        return Promise.resolve({ ok: false, status: 400, json: () => Promise.resolve({ error: "ng" }) });
      }
      const row = server.find((r) => r.id === m[1]);
      if (row) {
        row.useStatus = "USED";
        row.fulfilled = true;
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ ok: true, id: m[1], useStatus: "USED", fulfilled: true }),
      });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });
  global.fetch = fetchSpy as unknown as typeof fetch;
  return fetchSpy;
}

async function renderPage() {
  await act(async () => {
    render(<ParentTreasureHistoryPage />);
  });
  await waitFor(() => expect(screen.getByText("おやつ")).toBeTruthy());
}

async function openModalAndConfirm() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /つかった/ }));
  });
  await act(async () => {
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: /使用済みにする/ }));
  });
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("親 pending ページ — 「つかった」ボタン表示条件（#164）", () => {
  it("UNUSED の行に「つかった」ボタンが出る", async () => {
    setupFetch({ items: [sampleItem] });
    await renderPage();
    expect(screen.getByRole("button", { name: /つかった/ })).toBeTruthy();
  });

  it("USE_REQUESTED の行にも「つかった」ボタンが出る（申請中表示は維持）", async () => {
    setupFetch({ items: [{ ...sampleItem, useStatus: "USE_REQUESTED" }] });
    await renderPage();
    expect(screen.getByRole("button", { name: /つかった/ })).toBeTruthy();
    expect(screen.getByText(/使用申請中/)).toBeTruthy();
  });

  it("USED の行には「つかった」ボタンは出ず、取り消しボタンのみ", async () => {
    setupFetch({ items: [{ ...sampleItem, useStatus: "USED", fulfilled: true }] });
    await renderPage();
    expect(screen.queryByRole("button", { name: /つかった/ })).toBeNull();
    expect(screen.getByRole("button", { name: /使用を取り消す/ })).toBeTruthy();
  });

  it("保持期間外（visibleToChild:false）の行には「つかった」ボタンを出さない", async () => {
    setupFetch({ items: [{ ...sampleItem, visibleToChild: false }] });
    await renderPage();
    expect(screen.queryByRole("button", { name: /つかった/ })).toBeNull();
  });

  it("visibleToChild:true の行には出る（境界）", async () => {
    setupFetch({ items: [{ ...sampleItem, visibleToChild: true }] });
    await renderPage();
    expect(screen.getByRole("button", { name: /つかった/ })).toBeTruthy();
  });

  it("useStatus 未取得（旧レスポンス）でも fulfilled=false なら UNUSED 扱いでボタンが出る", async () => {
    const legacy: Row = { ...sampleItem };
    delete legacy.useStatus;
    setupFetch({ items: [legacy] });
    await renderPage();
    expect(screen.getByRole("button", { name: /つかった/ })).toBeTruthy();
  });
});

describe("親 pending ページ — 確認モーダルと実行（#164）", () => {
  it("「つかった」を押すだけでは API を呼ばず、確認モーダルが開く", async () => {
    const onUse = vi.fn();
    setupFetch({ items: [sampleItem], onUse });
    await renderPage();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /つかった/ }));
    });

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(onUse).not.toHaveBeenCalled();
  });

  it("モーダルのキャンセルで閉じ、API は呼ばれず状態も変わらない", async () => {
    const onUse = vi.fn();
    setupFetch({ items: [sampleItem], onUse });
    await renderPage();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /つかった/ }));
    });
    await act(async () => {
      fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: /キャンセル/ }));
    });

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(onUse).not.toHaveBeenCalled();
    expect(screen.getByText("未使用")).toBeTruthy();
  });

  it("確認すると POST /api/treasures/use/[id] を呼び、「使用済み」表示に変わる（UNUSED 起点）", async () => {
    const onUse = vi.fn();
    setupFetch({ items: [sampleItem], onUse });
    await renderPage();

    await openModalAndConfirm();

    await waitFor(() => expect(onUse).toHaveBeenCalledWith("t1", expect.objectContaining({ method: "POST" })));
    await waitFor(() => expect(screen.getByText("✅ 使用済み")).toBeTruthy());
    expect(screen.queryByRole("button", { name: /つかった/ })).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("USE_REQUESTED 起点でも成功すると「使用済み」になり、申請中表示は消える", async () => {
    setupFetch({ items: [{ ...sampleItem, useStatus: "USE_REQUESTED" }] });
    await renderPage();

    await openModalAndConfirm();

    await waitFor(() => expect(screen.getByText("✅ 使用済み")).toBeTruthy());
    expect(screen.queryByText(/使用申請中/)).toBeNull();
  });

  it("失敗（400）時は操作前の USE_REQUESTED（申請中表示）に戻る。UNUSED に落とさない", async () => {
    setupFetch({ items: [{ ...sampleItem, useStatus: "USE_REQUESTED" }], useOk: false });
    await renderPage();

    await openModalAndConfirm();

    await waitFor(() => expect(screen.getByText(/使用申請中/)).toBeTruthy());
    expect(screen.queryByText("未使用")).toBeNull();
    expect(screen.queryByText("✅ 使用済み")).toBeNull();
  });

  it("失敗時は UNUSED 起点なら UNUSED（未使用）に戻る", async () => {
    setupFetch({ items: [sampleItem], useOk: false });
    await renderPage();

    await openModalAndConfirm();

    await waitFor(() => expect(screen.getByText("未使用")).toBeTruthy());
    expect(screen.queryByText("✅ 使用済み")).toBeNull();
  });

  it("ネットワーク例外でも元の状態（USE_REQUESTED）に戻る", async () => {
    setupFetch({ items: [{ ...sampleItem, useStatus: "USE_REQUESTED" }], useThrows: true });
    await renderPage();

    await openModalAndConfirm();

    await waitFor(() => expect(screen.getByText(/使用申請中/)).toBeTruthy());
  });
});
