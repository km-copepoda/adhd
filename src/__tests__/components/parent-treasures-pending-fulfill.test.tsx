// @vitest-environment jsdom
// #151: 親 pending ページのごほうび使用申請ステータス表示 / 「使用済み」の取り消しボタン UI 動作。
// 承認・却下は承認センター（/app/parent/approve）の責務。ここは USED -> UNUSED の巻き戻しのみ。
import { render, screen, waitFor, act, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/components/parent/ParentTreasureTabs", () => ({
  default: () => null,
}));

import ParentTreasureHistoryPage from "@/app/app/parent/(app)/treasures/pending/page";

type TreasureUseStatus = "UNUSED" | "USE_REQUESTED" | "USED";

function setupFetch(opts: {
  items: Array<{
    id: string;
    openedAt: string;
    item: { id: string; title: string; rarity: "COMMON" | "UNCOMMON" | "RARE" } | null;
    child: { id: string; name: string | null; monsterName: string | null };
    fulfilled: boolean;
    useStatus?: TreasureUseStatus;
    visibleToChild?: boolean;
  }>;
  members?: Array<{ id: string; role: "CHILD" | "PARENT"; name: string | null; monsterName: string | null }>;
  onRevoke?: (id: string) => void;
}) {
  const fetchSpy = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    if (typeof url === "string" && url.includes("/api/treasures/pending")) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ items: opts.items }) });
    }
    if (typeof url === "string" && url.includes("/api/family/code")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ members: opts.members ?? [] }),
      });
    }
    const m = typeof url === "string" && url.match(/\/api\/treasures\/fulfill\/([^/]+)/);
    if (m && init?.method === "POST") {
      opts.onRevoke?.(m[1]);
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ ok: true, id: m[1], useStatus: "UNUSED", fulfilled: false }),
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
  useStatus: "UNUSED" as TreasureUseStatus,
};

describe("親 pending ページ — ごほうび使用申請ステータス表示（#151）", () => {
  it("UNUSED の行に「未使用」表示が出て取り消しボタンは出ない", async () => {
    setupFetch({ items: [sampleItem] });
    await act(async () => {
      render(<ParentTreasureHistoryPage />);
    });
    await waitFor(() => expect(screen.getByText("おやつ")).toBeTruthy());
    expect(screen.getByText("未使用")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /使用を取り消す/ })).toBeNull();
  });

  it("USE_REQUESTED の行に「使用申請中」表示が出て取り消しボタンは出ない", async () => {
    setupFetch({ items: [{ ...sampleItem, useStatus: "USE_REQUESTED" }] });
    await act(async () => {
      render(<ParentTreasureHistoryPage />);
    });
    await waitFor(() => expect(screen.getByText("おやつ")).toBeTruthy());
    expect(screen.getByText(/使用申請中/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /使用を取り消す/ })).toBeNull();
  });

  it("USED の行に「使用済み」表示が出て取り消しボタンが表示される", async () => {
    setupFetch({ items: [{ ...sampleItem, useStatus: "USED", fulfilled: true }] });
    await act(async () => {
      render(<ParentTreasureHistoryPage />);
    });
    await waitFor(() => expect(screen.getByText("おやつ")).toBeTruthy());
    expect(screen.getByText("✅ 使用済み")).toBeTruthy();
    expect(screen.getByRole("button", { name: /使用を取り消す/ })).toBeTruthy();
  });

  it("取り消しボタンを押すと fulfill API を呼び出し、UI が「未使用」表示に切り替わる", async () => {
    const onRevoke = vi.fn();
    setupFetch({ items: [{ ...sampleItem, useStatus: "USED", fulfilled: true }], onRevoke });
    await act(async () => {
      render(<ParentTreasureHistoryPage />);
    });
    await waitFor(() => expect(screen.getByText("おやつ")).toBeTruthy());

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /使用を取り消す/ }));
    });

    await waitFor(() => {
      expect(onRevoke).toHaveBeenCalledWith("t1");
    });
    await waitFor(() => expect(screen.getByText("未使用")).toBeTruthy());
  });
});

describe("親 pending ページ — visibleToChild グレーアウト (#72)", () => {
  it("visibleToChild:false の行はグレーアウトされ「子画面では非表示」ラベルが付く", async () => {
    setupFetch({ items: [{ ...sampleItem, visibleToChild: false }] });
    await act(async () => {
      render(<ParentTreasureHistoryPage />);
    });
    await waitFor(() => expect(screen.getByText("おやつ")).toBeTruthy());

    const li = screen.getByText("おやつ").closest("li");
    expect(li?.className ?? "").toMatch(/opacity-50/);
    expect(screen.getByText(/子画面では非表示/)).toBeTruthy();
  });

  it("visibleToChild:true の行は通常表示（グレーアウト・ラベルなし）", async () => {
    setupFetch({ items: [{ ...sampleItem, visibleToChild: true }] });
    await act(async () => {
      render(<ParentTreasureHistoryPage />);
    });
    await waitFor(() => expect(screen.getByText("おやつ")).toBeTruthy());

    const li = screen.getByText("おやつ").closest("li");
    expect(li?.className ?? "").not.toMatch(/opacity-50/);
    expect(screen.queryByText(/子画面では非表示/)).toBeNull();
  });
});

// #171: 保持期間外（visibleToChild:false）の行は取り消せない。#72 の「グレーアウト行でもトグル可能」を上書き。
describe("親 pending ページ — 「使用を取り消す」の表示条件 (#171)", () => {
  async function renderWith(item: Record<string, unknown>) {
    setupFetch({ items: [{ ...sampleItem, ...item }] as Parameters<typeof setupFetch>[0]["items"] });
    await act(async () => {
      render(<ParentTreasureHistoryPage />);
    });
    await waitFor(() => expect(screen.getByText("おやつ")).toBeTruthy());
  }
  const revokeBtn = () => screen.queryByRole("button", { name: /使用を取り消す/ });

  it("USED + visibleToChild:false（期限切れ）は取り消しボタンなし", async () => {
    await renderWith({ useStatus: "USED", fulfilled: true, visibleToChild: false });
    expect(revokeBtn()).toBeNull();
  });

  it("USED + visibleToChild:true は取り消しボタンあり", async () => {
    await renderWith({ useStatus: "USED", fulfilled: true, visibleToChild: true });
    expect(revokeBtn()).toBeTruthy();
  });

  it("USED + visibleToChild 未取得（旧レスポンス）は後方互換で取り消しボタンあり", async () => {
    await renderWith({ useStatus: "USED", fulfilled: true });
    expect(revokeBtn()).toBeTruthy();
  });

  it("UNUSED + visibleToChild:true は取り消しボタンなし", async () => {
    await renderWith({ useStatus: "UNUSED", visibleToChild: true });
    expect(revokeBtn()).toBeNull();
  });

  it("USE_REQUESTED + visibleToChild:true は取り消しボタンなし", async () => {
    await renderWith({ useStatus: "USE_REQUESTED", visibleToChild: true });
    expect(revokeBtn()).toBeNull();
  });

  it("USED + visibleToChild:false でも行は表示され「子画面では非表示」ラベルが残る", async () => {
    await renderWith({ useStatus: "USED", fulfilled: true, visibleToChild: false });
    expect(screen.getByText("✅ 使用済み")).toBeTruthy();
    expect(screen.getByText(/子画面では非表示/)).toBeTruthy();
  });
});

describe("親 pending ページ — 説明文 (#151)", () => {
  it("「子供には見えません」という誤った記述を出さない", async () => {
    setupFetch({ items: [sampleItem] });
    await act(async () => {
      render(<ParentTreasureHistoryPage />);
    });
    await waitFor(() => expect(screen.getByText("おやつ")).toBeTruthy());
    expect(screen.queryByText(/子供には見えません/)).toBeNull();
    expect(screen.queryByText(/子供には表示されません/)).toBeNull();
  });

  it("使用申請・承認フローに触れる説明を出す", async () => {
    setupFetch({ items: [sampleItem] });
    await act(async () => {
      render(<ParentTreasureHistoryPage />);
    });
    await waitFor(() => expect(screen.getByText("おやつ")).toBeTruthy());
    expect(screen.getByText(/承認センター/)).toBeTruthy();
  });
});

describe("親 pending ページ — 子供フィルタ", () => {
  const itemTaro = {
    id: "t1",
    openedAt: new Date().toISOString(),
    item: { id: "i1", title: "おやつ", rarity: "COMMON" as const },
    child: { id: "c1", name: "太郎", monsterName: "ドラゴン" },
    fulfilled: false,
  };
  const itemHanako = {
    id: "t2",
    openedAt: new Date().toISOString(),
    item: { id: "i2", title: "ジュース", rarity: "COMMON" as const },
    child: { id: "c2", name: "花子", monsterName: "ユニコーン" },
    fulfilled: false,
  };
  const twoChildren = [
    { id: "c1", role: "CHILD" as const, name: "太郎", monsterName: "ドラゴン" },
    { id: "c2", role: "CHILD" as const, name: "花子", monsterName: "ユニコーン" },
  ];

  it("子供が複数いる場合、画面上部に子供アイコンの切替ボタンが表示される", async () => {
    setupFetch({ items: [itemTaro, itemHanako], members: twoChildren });
    await act(async () => {
      render(<ParentTreasureHistoryPage />);
    });
    await waitFor(() => expect(screen.getByText("おやつ")).toBeTruthy());
    expect(screen.getByRole("button", { name: /ドラゴン/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /ユニコーン/ })).toBeTruthy();
  });

  it("子供アイコンをクリックすると履歴がその子供だけに絞り込まれる", async () => {
    setupFetch({ items: [itemTaro, itemHanako], members: twoChildren });
    await act(async () => {
      render(<ParentTreasureHistoryPage />);
    });
    await waitFor(() => expect(screen.getByText("おやつ")).toBeTruthy());

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /ユニコーン/ }));
    });

    await waitFor(() => expect(screen.queryByText("おやつ")).toBeNull());
    expect(screen.getByText("ジュース")).toBeTruthy();
  });

  it("子供が1人だけの場合は切替ボタンを表示しない", async () => {
    setupFetch({
      items: [itemTaro],
      members: [{ id: "c1", role: "CHILD", name: "太郎", monsterName: "ドラゴン" }],
    });
    await act(async () => {
      render(<ParentTreasureHistoryPage />);
    });
    await waitFor(() => expect(screen.getByText("おやつ")).toBeTruthy());
    expect(screen.queryByRole("button", { name: /ドラゴン/ })).toBeNull();
  });
});
