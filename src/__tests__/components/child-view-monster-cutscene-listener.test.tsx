// @vitest-environment jsdom
import { render, screen, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("next/image", () => ({
  __esModule: true,
  default: ({ src, alt }: { src: string; alt: string }) => (
    <img src={src} alt={alt} />
  ),
}));

// 親モードでは Realtime 購読を行わない方針（decisions.md 2026-05-11）。
// このリスナーは Supabase Realtime を使わず、CustomEvent("child-view-monster-refresh")
// を起点に再フェッチして進化検知する設計とする。
import ChildViewMonsterCutsceneListener from "@/components/parent/ChildViewMonsterCutsceneListener";

type Status = {
  evolutionStage: number;
  evolutionPath: string;
  side: string | null;
};

function setupFetch(initial: Status, ...subsequent: Status[]) {
  const queue: Status[] = [initial, ...subsequent];
  global.fetch = vi.fn().mockImplementation((url: string) => {
    if (url.includes("/api/parent/child-view/monster-status")) {
      const d = queue.length > 1 ? queue.shift()! : queue[0];
      return Promise.resolve({ ok: true, json: () => Promise.resolve(d) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ChildViewMonsterCutsceneListener — 親モード代理操作後の進化カットイン", () => {
  it("childId クエリパラメータ付きで /api/parent/child-view/monster-status を叩く", async () => {
    const fetchSpy = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/api/parent/child-view/monster-status")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ evolutionStage: 1, evolutionPath: "STUDY", side: null }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
    global.fetch = fetchSpy as unknown as typeof fetch;

    await act(async () => {
      render(<ChildViewMonsterCutsceneListener childId="child-1" />);
    });

    await waitFor(() => {
      expect(
        fetchSpy.mock.calls.some(
          ([u]) =>
            typeof u === "string" &&
            u.includes("/api/parent/child-view/monster-status?childId=child-1"),
        ),
      ).toBe(true);
    });
  });

  it("CustomEvent('child-view-monster-refresh') を受けて再フェッチし、stage が増えていれば『進化した！』カットインを出す", async () => {
    setupFetch(
      { evolutionStage: 2, evolutionPath: "STUDY_STUDY", side: null },
      { evolutionStage: 3, evolutionPath: "STUDY_STUDY_STUDY", side: null },
    );

    await act(async () => {
      render(<ChildViewMonsterCutsceneListener childId="child-1" />);
    });

    // 親が代理報告 → ページが event を発火
    await act(async () => {
      window.dispatchEvent(new CustomEvent("child-view-monster-refresh"));
    });

    await waitFor(() => {
      expect(screen.getByText("進化した！")).toBeTruthy();
    });
  });

  it("stage 0→1 のとき『うまれた！』カットインを出す", async () => {
    setupFetch(
      { evolutionStage: 0, evolutionPath: "", side: null },
      { evolutionStage: 1, evolutionPath: "STUDY", side: null },
    );

    await act(async () => {
      render(<ChildViewMonsterCutsceneListener childId="child-1" />);
    });

    await act(async () => {
      window.dispatchEvent(new CustomEvent("child-view-monster-refresh"));
    });

    await waitFor(() => {
      expect(screen.getByText("うまれた！")).toBeTruthy();
    });
  });

  it("stage が変化しないリフレッシュではカットインを出さない", async () => {
    setupFetch(
      { evolutionStage: 2, evolutionPath: "STUDY_STUDY", side: null },
      { evolutionStage: 2, evolutionPath: "STUDY_STUDY", side: null },
    );

    await act(async () => {
      render(<ChildViewMonsterCutsceneListener childId="child-1" />);
    });

    await act(async () => {
      window.dispatchEvent(new CustomEvent("child-view-monster-refresh"));
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByText("進化した！")).toBeNull();
    expect(screen.queryByText("うまれた！")).toBeNull();
  });

  it("rebirth で stage が下がっても演出を出さない", async () => {
    setupFetch(
      { evolutionStage: 3, evolutionPath: "STUDY_STUDY_STUDY", side: null },
      { evolutionStage: 0, evolutionPath: "", side: null },
    );

    await act(async () => {
      render(<ChildViewMonsterCutsceneListener childId="child-1" />);
    });

    await act(async () => {
      window.dispatchEvent(new CustomEvent("child-view-monster-refresh"));
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByText("進化した！")).toBeNull();
    expect(screen.queryByText("うまれた！")).toBeNull();
  });

  it("初回マウント時、localStorage の child 別キーに保存された lastSeen より stage が進んでいればカットインを出す（クロスセッション検知）", async () => {
    localStorage.setItem("lastSeenEvolutionStage:child-1", "1");
    setupFetch({ evolutionStage: 2, evolutionPath: "STUDY_STUDY", side: null });

    await act(async () => {
      render(<ChildViewMonsterCutsceneListener childId="child-1" />);
    });

    await waitFor(() => {
      expect(screen.getByText("進化した！")).toBeTruthy();
    });
  });

  it("初回マウント時、lastSeen 未設定（初訪問）なら過去進化を遡及表示せず lastSeen を記録だけする", async () => {
    setupFetch({ evolutionStage: 3, evolutionPath: "STUDY_STUDY_STUDY", side: null });

    await act(async () => {
      render(<ChildViewMonsterCutsceneListener childId="child-1" />);
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByText("進化した！")).toBeNull();
    expect(localStorage.getItem("lastSeenEvolutionStage:child-1")).toBe("3");
  });

  it("カットイン表示後、child 別の lastSeen キーが新しい stage で更新される", async () => {
    localStorage.setItem("lastSeenEvolutionStage:child-1", "2");
    setupFetch(
      { evolutionStage: 2, evolutionPath: "STUDY_STUDY", side: null },
      { evolutionStage: 3, evolutionPath: "STUDY_STUDY_STUDY", side: null },
    );

    await act(async () => {
      render(<ChildViewMonsterCutsceneListener childId="child-1" />);
    });

    await act(async () => {
      window.dispatchEvent(new CustomEvent("child-view-monster-refresh"));
    });

    await waitFor(() => {
      expect(localStorage.getItem("lastSeenEvolutionStage:child-1")).toBe("3");
    });
  });

  it("別の子を見るとき、child 別キーで lastSeen が独立する（兄弟切り替えで誤発火しない）", async () => {
    // 兄の lastSeen は 3、弟の lastSeen は 1 にしておく
    localStorage.setItem("lastSeenEvolutionStage:child-1", "3");
    localStorage.setItem("lastSeenEvolutionStage:child-2", "1");
    // 弟（child-2）を選んだとき、API は弟の stage=2 を返す → 1→2 なので進化カットインが出る
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/api/parent/child-view/monster-status?childId=child-2")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({ evolutionStage: 2, evolutionPath: "STUDY_STUDY", side: null }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }) as unknown as typeof fetch;

    await act(async () => {
      render(<ChildViewMonsterCutsceneListener childId="child-2" />);
    });

    await waitFor(() => {
      expect(screen.getByText("進化した！")).toBeTruthy();
    });
    // 兄のキーは触らない
    expect(localStorage.getItem("lastSeenEvolutionStage:child-1")).toBe("3");
    expect(localStorage.getItem("lastSeenEvolutionStage:child-2")).toBe("2");
  });
});
