// @vitest-environment jsdom
import { render, screen, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("next/image", () => ({
  __esModule: true,
  default: ({ src, alt }: { src: string; alt: string }) => (
    <img src={src} alt={alt} />
  ),
}));

// Supabase Realtime: 登録された UPDATE コールバックを capture して
// テストから手動で発火できるようにする。
let userUpdateCallback: (() => void) | null = null;
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    channel: () => ({
      on: function (
        _event: string,
        filter: { table?: string; event?: string },
        cb: () => void,
      ) {
        if (filter.table === "User" && filter.event === "UPDATE") {
          userUpdateCallback = cb;
        }
        return this;
      },
      subscribe: function () {
        return this;
      },
    }),
    removeChannel: vi.fn(),
  }),
}));

import MonsterCutsceneListener from "@/components/child/MonsterCutsceneListener";

type Status = {
  evolutionStage: number;
  evolutionPath: string;
  side: string | null;
  monsterSetId?: string;
};

function setupFetch(initial: Status, ...subsequent: Status[]) {
  const queue: Status[] = [initial, ...subsequent];
  global.fetch = vi.fn().mockImplementation((url: string) => {
    if (url.includes("/api/monster-status")) {
      const d = queue.length > 1 ? queue.shift()! : queue[0];
      return Promise.resolve({ ok: true, json: () => Promise.resolve(d) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  userUpdateCallback = null;
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("MonsterCutsceneListener — 子レイアウト常駐の進化カットイン", () => {
  it("Realtime UPDATE で stage が増えたとき『進化した！』カットインを表示する", async () => {
    setupFetch(
      { evolutionStage: 2, evolutionPath: "STUDY_STUDY", side: null },
      { evolutionStage: 3, evolutionPath: "STUDY_STUDY_STUDY", side: null },
    );

    await act(async () => {
      render(<MonsterCutsceneListener />);
    });
    await waitFor(() => expect(userUpdateCallback).not.toBeNull());

    // 親がスタンプ承認 → User.evolutionStage が 2→3 に更新
    await act(async () => {
      userUpdateCallback!();
    });

    await waitFor(() => {
      expect(screen.getByText("進化した！")).toBeTruthy();
    });
  });

  it("Realtime UPDATE で stage が 0→1 になったとき『うまれた！』カットインを表示する", async () => {
    setupFetch(
      { evolutionStage: 0, evolutionPath: "", side: null },
      { evolutionStage: 1, evolutionPath: "STUDY", side: null },
    );

    await act(async () => {
      render(<MonsterCutsceneListener />);
    });
    await waitFor(() => expect(userUpdateCallback).not.toBeNull());

    await act(async () => {
      userUpdateCallback!();
    });

    await waitFor(() => {
      expect(screen.getByText("うまれた！")).toBeTruthy();
    });
  });

  it("stage が変化しない UPDATE（XP 加算のみ）ではカットインを出さない", async () => {
    setupFetch(
      { evolutionStage: 2, evolutionPath: "STUDY_STUDY", side: null },
      { evolutionStage: 2, evolutionPath: "STUDY_STUDY", side: null },
    );

    await act(async () => {
      render(<MonsterCutsceneListener />);
    });
    await waitFor(() => expect(userUpdateCallback).not.toBeNull());

    await act(async () => {
      userUpdateCallback!();
    });

    // 表示されないことを待ってから確認
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByText("進化した！")).toBeNull();
    expect(screen.queryByText("うまれた！")).toBeNull();
  });

  it("rebirth (stage が下がる UPDATE) ではカットインを出さない", async () => {
    setupFetch(
      { evolutionStage: 3, evolutionPath: "STUDY_STUDY_STUDY", side: null },
      { evolutionStage: 0, evolutionPath: "", side: null },
    );

    await act(async () => {
      render(<MonsterCutsceneListener />);
    });
    await waitFor(() => expect(userUpdateCallback).not.toBeNull());

    await act(async () => {
      userUpdateCallback!();
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByText("進化した！")).toBeNull();
    expect(screen.queryByText("うまれた！")).toBeNull();
  });

  it("初回マウント時、localStorage の lastSeenEvolutionStage より stage が進んでいればカットインを出す（クロスセッション検知）", async () => {
    localStorage.setItem("lastSeenEvolutionStage", "1");
    setupFetch({ evolutionStage: 2, evolutionPath: "STUDY_STUDY", side: null });

    await act(async () => {
      render(<MonsterCutsceneListener />);
    });

    await waitFor(() => {
      expect(screen.getByText("進化した！")).toBeTruthy();
    });
  });

  it("初回マウント時、lastSeenEvolutionStage 未設定（初訪問）なら過去進化を遡及表示しない", async () => {
    setupFetch({ evolutionStage: 3, evolutionPath: "STUDY_STUDY_STUDY", side: null });

    await act(async () => {
      render(<MonsterCutsceneListener />);
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByText("進化した！")).toBeNull();
    // 以降の差分検知のために lastSeen は記録される
    expect(localStorage.getItem("lastSeenEvolutionStage")).toBe("3");
  });

  it("Issue #100: monsterSetId が buddha のとき、カットインに buddha テーマの画像が表示される（side は無視される）", async () => {
    // side は null（未設定）だが monsterSetId が buddha を優先するべき
    setupFetch(
      { evolutionStage: 0, evolutionPath: "", side: null, monsterSetId: "buddha" },
      { evolutionStage: 1, evolutionPath: "STUDY", side: null, monsterSetId: "buddha" },
    );

    await act(async () => {
      render(<MonsterCutsceneListener />);
    });
    await waitFor(() => expect(userUpdateCallback).not.toBeNull());

    await act(async () => {
      userUpdateCallback!();
    });

    await waitFor(() => {
      const img = screen.getByAltText("文殊丸");
      expect((img as HTMLImageElement).src).toContain("/monsters/buddha/STUDY_");
    });
  });

  it("カットイン表示後、lastSeenEvolutionStage は新ステージで更新される", async () => {
    localStorage.setItem("lastSeenEvolutionStage", "2");
    setupFetch(
      { evolutionStage: 2, evolutionPath: "STUDY_STUDY", side: null },
      { evolutionStage: 3, evolutionPath: "STUDY_STUDY_STUDY", side: null },
    );

    await act(async () => {
      render(<MonsterCutsceneListener />);
    });
    await waitFor(() => expect(userUpdateCallback).not.toBeNull());

    await act(async () => {
      userUpdateCallback!();
    });

    await waitFor(() => {
      expect(localStorage.getItem("lastSeenEvolutionStage")).toBe("3");
    });
  });
});
