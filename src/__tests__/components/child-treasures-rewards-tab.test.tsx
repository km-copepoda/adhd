// @vitest-environment jsdom
// #72 — 子モードの新サブタブ「🎁 ごほうび一覧」。
// item !== null（実ごほうび当選）かつ保持期間内（30日）の行だけを一覧し、
// 各行の「つかう / つかったよ」トグルで子専用 fulfill ルートを叩く（楽観更新）。
import { render, screen, waitFor, act, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("next/image", () => ({
  __esModule: true,
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

vi.mock("@/components/LoadingSpinner", () => ({
  default: () => <div data-testid="loading-spinner" />,
}));

import ChildTreasuresPage from "@/app/app/child/treasures/page";

interface FulfillCall {
  id: string;
  fulfilled: boolean;
}

function setupFetch(opts?: {
  opened?: unknown[];
  rewards?: unknown[];
  fulfillOk?: boolean;
  onFulfill?: (c: FulfillCall) => void;
}) {
  const opened =
    opts?.opened ?? [
      {
        id: "log-1",
        openedAt: "2026-05-29T00:00:00Z",
        boosted: false,
        item: { id: "i1", title: "シール", rarity: "COMMON" },
        collectionItem: null,
        fulfilled: false,
      },
      {
        id: "log-2",
        openedAt: "2026-05-28T00:00:00Z",
        boosted: false,
        item: null,
        collectionItem: {
          id: "summer-01",
          name: "カブトムシ",
          season: "summer",
          rarity: "COMMON",
          image: "/collection-items/summer/kabuto.png",
        },
        fulfilled: false,
      },
    ];

  const fetchSpy = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    if (url.includes("/api/treasures/status")) {
      const body: Record<string, unknown> = { locked: 0, unlocked: 0, opened };
      if (opts?.rewards) body.rewards = opts.rewards;
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(body),
      });
    }
    const m = url.match(/\/api\/child\/treasures\/fulfill\/([^/?]+)/);
    if (m && init?.method === "POST") {
      const body = JSON.parse(init.body as string) as { fulfilled: boolean };
      opts?.onFulfill?.({ id: m[1], fulfilled: body.fulfilled });
      return Promise.resolve({
        ok: opts?.fulfillOk ?? true,
        json: () => Promise.resolve({ ok: true, id: m[1], fulfilled: body.fulfilled }),
      });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });
  global.fetch = fetchSpy as unknown as typeof fetch;
  return fetchSpy;
}

beforeEach(() => {
  setupFetch();
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function renderAndOpenRewardsTab() {
  await act(async () => {
    render(<ChildTreasuresPage />);
  });
  await waitFor(() => expect(screen.getByText("これまでの宝箱")).toBeTruthy());
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /ごほうび一覧/ }));
  });
}

describe("/app/child/treasures — 🎁 ごほうび一覧 サブタブ (#72)", () => {
  it("サブタブに切り替えると item !== null の当選行だけ出る（コレクション行は出ない）", async () => {
    await renderAndOpenRewardsTab();
    await waitFor(() => expect(screen.getByText("シール")).toBeTruthy());
    expect(screen.queryByText("カブトムシ")).toBeNull();
  });

  it("「つかう」ボタン押下で POST /api/child/treasures/fulfill/[id] が飛ぶ", async () => {
    const onFulfill = vi.fn();
    setupFetch({ onFulfill });
    await renderAndOpenRewardsTab();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /つかう/ }));
    });

    await waitFor(() =>
      expect(onFulfill).toHaveBeenCalledWith({ id: "log-1", fulfilled: true }),
    );
  });

  it("使用済みになると「つかったよ」表示になりボタンが「とりけす」に変わる", async () => {
    await renderAndOpenRewardsTab();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /つかう/ }));
    });

    await waitFor(() => expect(screen.getByText(/つかったよ/)).toBeTruthy());
    expect(screen.getByRole("button", { name: /とりけす/ })).toBeTruthy();
  });

  it("fulfill API 失敗時は楽観更新をロールバックして「つかう」に戻る", async () => {
    setupFetch({ fulfillOk: false });
    await renderAndOpenRewardsTab();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /つかう/ }));
    });

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /つかう/ })).toBeTruthy(),
    );
    expect(screen.queryByText(/つかったよ/)).toBeNull();
  });

  // #127 follow-up — ごほうび一覧は開封履歴の50件上限と独立した rewards フィールドから描画する。
  it("rewards フィールドがあれば opened に無いごほうびも一覧に出る", async () => {
    setupFetch({
      opened: [
        {
          id: "c-1",
          openedAt: "2026-05-20T00:00:00Z",
          boosted: false,
          item: null,
          collectionItem: {
            id: "s1",
            name: "カブトムシ",
            season: "summer",
            rarity: "COMMON",
            image: "/collection-items/summer/kabuto.png",
          },
          fulfilled: false,
        },
      ],
      rewards: [
        {
          id: "rw-far",
          openedAt: "2026-05-01T00:00:00Z",
          boosted: false,
          item: { id: "i9", title: "とおいごほうび", rarity: "COMMON" },
          collectionItem: null,
          fulfilled: false,
        },
      ],
    });
    await renderAndOpenRewardsTab();
    await waitFor(() => expect(screen.getByText("とおいごほうび")).toBeTruthy());
  });

  it("rewards 由来の行でも「つかう」トグルが楽観更新される", async () => {
    setupFetch({
      opened: [],
      rewards: [
        {
          id: "rw-1",
          openedAt: "2026-05-01T00:00:00Z",
          boosted: false,
          item: { id: "i1", title: "シール", rarity: "COMMON" },
          collectionItem: null,
          fulfilled: false,
        },
      ],
    });
    await renderAndOpenRewardsTab();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /つかう/ }));
    });

    await waitFor(() => expect(screen.getByText(/つかったよ/)).toBeTruthy());
    expect(screen.getByRole("button", { name: /とりけす/ })).toBeTruthy();
  });

  it("二重クリックしても fulfill リクエストは1回だけ（多重送信ガード）", async () => {
    const onFulfill = vi.fn();
    setupFetch({ onFulfill });
    await renderAndOpenRewardsTab();

    const btn = screen.getByRole("button", { name: /つかう/ });
    await act(async () => {
      fireEvent.click(btn);
      fireEvent.click(btn);
    });

    await waitFor(() => expect(onFulfill).toHaveBeenCalled());
    expect(onFulfill).toHaveBeenCalledTimes(1);
  });
});
