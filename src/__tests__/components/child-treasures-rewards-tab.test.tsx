// @vitest-environment jsdom
// #151 — 子モードの「🎁 ごほうび一覧」サブタブ。
// item !== null（実ごほうび当選）かつ保持期間内（30日）の行だけを一覧し、
// 各行の「つかう」ボタンで子専用 use-request ルートを叩く（一方向・楽観更新・取り消し不可）。
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

interface UseRequestCall {
  id: string;
}

function setupFetch(opts?: {
  opened?: unknown[];
  rewards?: unknown[];
  useRequestOk?: boolean;
  onUseRequest?: (c: UseRequestCall) => void;
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
        useStatus: "UNUSED",
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
        useStatus: "UNUSED",
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
    const m = url.match(/\/api\/child\/treasures\/use-request\/([^/?]+)/);
    if (m && init?.method === "POST") {
      opts?.onUseRequest?.({ id: m[1] });
      return Promise.resolve({
        ok: opts?.useRequestOk ?? true,
        json: () => Promise.resolve({ ok: true, id: m[1], useStatus: "USE_REQUESTED", fulfilled: false }),
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

describe("/app/child/treasures — 🎁 ごほうび一覧 サブタブ (#151)", () => {
  it("サブタブに切り替えると item !== null の当選行だけ出る（コレクション行は出ない）", async () => {
    await renderAndOpenRewardsTab();
    await waitFor(() => expect(screen.getByText("シール")).toBeTruthy());
    expect(screen.queryByText("カブトムシ")).toBeNull();
  });

  it("「つかう」ボタン押下では即申請せず、確認モーダルを挟んでから POST /api/child/treasures/use-request/[id] が飛ぶ", async () => {
    const onUseRequest = vi.fn();
    setupFetch({ onUseRequest });
    await renderAndOpenRewardsTab();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "つかう" }));
    });

    // モーダルが出た時点ではまだ申請されていない
    await waitFor(() => expect(screen.getByText("つかっていい？")).toBeTruthy());
    expect(onUseRequest).not.toHaveBeenCalled();

    // モーダル内の確定ボタン（テキストは行内ボタンと同じ「つかう」なので複数ヒットする最後の要素 = モーダル側）
    await act(async () => {
      const confirmButtons = screen.getAllByRole("button", { name: "つかう" });
      fireEvent.click(confirmButtons[confirmButtons.length - 1]);
    });

    await waitFor(() =>
      expect(onUseRequest).toHaveBeenCalledWith({ id: "log-1" }),
    );
  });

  it("確認モーダルで「キャンセル」を押すと申請は飛ばずモーダルが閉じる", async () => {
    const onUseRequest = vi.fn();
    setupFetch({ onUseRequest });
    await renderAndOpenRewardsTab();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "つかう" }));
    });
    await waitFor(() => expect(screen.getByText("つかっていい？")).toBeTruthy());

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "キャンセル" }));
    });

    expect(screen.queryByText("つかっていい？")).toBeNull();
    expect(onUseRequest).not.toHaveBeenCalled();
    // ボタンは「つかう」のまま（UNUSED）
    expect(screen.getByRole("button", { name: "つかう" })).toBeTruthy();
  });

  it("申請すると「しんせいちゅう」表示になりボタンが無効化される（取り消し不可）", async () => {
    await renderAndOpenRewardsTab();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "つかう" }));
    });
    await waitFor(() => expect(screen.getByText("つかっていい？")).toBeTruthy());
    await act(async () => {
      const confirmButtons = screen.getAllByRole("button", { name: "つかう" });
      fireEvent.click(confirmButtons[confirmButtons.length - 1]);
    });

    await waitFor(() => expect(screen.getByRole("button", { name: /しんせいちゅう/ })).toBeTruthy());
    const btn = screen.getByRole("button", { name: /しんせいちゅう/ });
    expect(btn).toBeDisabled();
  });

  it("use-request API 失敗時は楽観更新をロールバックして「つかう」に戻る", async () => {
    setupFetch({ useRequestOk: false });
    await renderAndOpenRewardsTab();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "つかう" }));
    });
    await waitFor(() => expect(screen.getByText("つかっていい？")).toBeTruthy());
    await act(async () => {
      const confirmButtons = screen.getAllByRole("button", { name: "つかう" });
      fireEvent.click(confirmButtons[confirmButtons.length - 1]);
    });

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "つかう" })).toBeTruthy(),
    );
    expect(screen.queryByText(/しんせいちゅう/)).toBeNull();
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
          useStatus: "UNUSED",
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
          useStatus: "UNUSED",
        },
      ],
    });
    await renderAndOpenRewardsTab();
    await waitFor(() => expect(screen.getByText("とおいごほうび")).toBeTruthy());
  });

  it("rewards 由来の行でも「つかう」申請が楽観更新される", async () => {
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
          useStatus: "UNUSED",
        },
      ],
    });
    await renderAndOpenRewardsTab();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "つかう" }));
    });
    await waitFor(() => expect(screen.getByText("つかっていい？")).toBeTruthy());
    await act(async () => {
      const confirmButtons = screen.getAllByRole("button", { name: "つかう" });
      fireEvent.click(confirmButtons[confirmButtons.length - 1]);
    });

    await waitFor(() => expect(screen.getByRole("button", { name: /しんせいちゅう/ })).toBeTruthy());
  });

  it("二重クリックしても use-request リクエストは1回だけ（多重送信ガード）", async () => {
    const onUseRequest = vi.fn();
    setupFetch({ onUseRequest });
    await renderAndOpenRewardsTab();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "つかう" }));
    });
    await waitFor(() => expect(screen.getByText("つかっていい？")).toBeTruthy());

    const confirmBtn = screen.getAllByRole("button", { name: "つかう" }).slice(-1)[0];
    await act(async () => {
      fireEvent.click(confirmBtn);
      fireEvent.click(confirmBtn);
    });

    await waitFor(() => expect(onUseRequest).toHaveBeenCalled());
    expect(onUseRequest).toHaveBeenCalledTimes(1);
  });
});
