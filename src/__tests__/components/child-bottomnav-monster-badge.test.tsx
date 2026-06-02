// @vitest-environment jsdom
import { render, screen, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

let mockPath = "/app/child/quests";
vi.mock("next/navigation", () => ({
  usePathname: () => mockPath,
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    channel: () => ({
      on: function () {
        return this;
      },
      subscribe: () => ({}),
    }),
    removeChannel: vi.fn(),
  }),
}));

import BottomNav from "@/components/child/BottomNav";

beforeEach(() => {
  mockPath = "/app/child/quests";
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// 育成タブの赤丸は `rebirthPending` か `evolutionStage > lastSeenStage` のとき出る。
// 転生 API 成功時に monster page が `monster-changed` イベントを dispatch し、
// BottomNav がそれを受けて `/api/monster-status` を再フェッチ → 赤丸が消える経路を担保する。
describe("子 BottomNav 育成タブの赤丸クリア (monster-changed イベント)", () => {
  it("rebirthPending=true → false の遷移を monster-changed イベントで反映する", async () => {
    let rebirthPending = true;
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/api/monster-status")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              evolutionStage: 0,
              evolutionPath: "",
              collectedPaths: "[]",
              studyPt: 0,
              staminaPt: 0,
              lifePt: 0,
              rebirthPending,
            }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }) as unknown as typeof fetch;

    await act(async () => {
      render(<BottomNav />);
    });

    // 初期: rebirthPending=true なので 育成 に赤丸が出ている
    await waitFor(() => {
      const link = screen.getByText("育成").closest("a") as HTMLElement;
      expect(link.querySelector(".bg-red-500")).not.toBeNull();
    });

    // 転生が走り rebirthPending=false になったとシミュレート
    rebirthPending = false;
    await act(async () => {
      window.dispatchEvent(new CustomEvent("monster-changed"));
    });

    // monster-changed を受けて再フェッチ → 赤丸が消える
    await waitFor(() => {
      const link = screen.getByText("育成").closest("a") as HTMLElement;
      expect(link.querySelector(".bg-red-500")).toBeNull();
    });
  });
});
