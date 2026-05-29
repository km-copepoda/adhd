// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/app/parent/child-view",
}));

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    // eslint-disable-next-line jsx-a11y/alt-text, @next/next/no-img-element
    return <img {...(props as { src: string; alt: string })} />;
  },
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

vi.mock("@/hooks/usePendingApprovalCount", () => ({
  usePendingCounts: () => ({ tasks: 0, approvals: 0 }),
}));

vi.mock("@/components/parent/PushSubscriber", () => ({
  default: () => <div data-testid="push-subscriber" />,
}));

vi.mock("@/components/LoadingSpinner", () => ({
  default: () => <div data-testid="loading-spinner" />,
}));

import ChildViewSelectorPage from "@/app/app/parent/child-view/page";

const child1 = {
  id: "child-1",
  name: "太郎",
  monsterName: "ラーン",
  side: "DARK",
  evolutionStage: 1,
  evolutionPath: "STUDY",
  studyPt: 2,
  staminaPt: 1,
  lifePt: 0,
  collectedPaths: "[]",
  rebirthEggBonus: null,
};

const child2 = {
  id: "child-2",
  name: "花子",
  monsterName: null,
  side: "LIGHT",
  evolutionStage: 0,
  evolutionPath: "",
  studyPt: 0,
  staminaPt: 0,
  lifePt: 0,
  collectedPaths: "[]",
  rebirthEggBonus: null,
};

beforeEach(() => {
  global.fetch = vi.fn().mockImplementation((url: string) => {
    if (typeof url === "string" && url.includes("/api/parent/child-view/children")) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve([child1, child2]) });
    }
    return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
  }) as unknown as typeof fetch;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ChildViewSelectorPage", () => {
  it("親代理操作では宝箱が出ない旨を案内する", async () => {
    render(<ChildViewSelectorPage />);
    await waitFor(() => expect(screen.getByText("ラーン")).toBeTruthy());
    const body = document.body.textContent ?? "";
    expect(body).toMatch(/宝箱|ごほうび/);
    expect(body).toMatch(/出ません|出ない|対象外/);
  });

  it("各子供のアイコンに子供のモンスター画像を表示する（絵文字ではない）", async () => {
    render(<ChildViewSelectorPage />);
    await waitFor(() => expect(screen.getByText("ラーン")).toBeTruthy());

    // STUDY パスの DARK 側モンスター画像が表示されること
    const img = screen.getByAltText("ラーン") as HTMLImageElement;
    expect(img).toBeTruthy();
    expect(img.src).toContain("/monsters/dark/STUDY_");
  });

  it("名前の下にXPバーが表示される（aria-valuenow と aria-valuemax を持つ progressbar）", async () => {
    render(<ChildViewSelectorPage />);
    await waitFor(() => expect(screen.getByText("ラーン")).toBeTruthy());

    const bars = screen.getAllByRole("progressbar");
    expect(bars.length).toBe(2);
    // 1人目（child-1）: stage 1, total=3, xpToEvolve は EVOLUTION_THRESHOLDS[1]
    expect(bars[0].getAttribute("aria-valuenow")).toBe("3");
    expect(Number(bars[0].getAttribute("aria-valuemax") ?? "0")).toBeGreaterThan(0);
  });

  it("フッターに親画面と同じ ParentBottomNav が表示される（タスク/承認/子供モード/完了/履歴/ひろば/家族）", async () => {
    render(<ChildViewSelectorPage />);
    await waitFor(() => expect(screen.getByText("ラーン")).toBeTruthy());

    expect(screen.getByRole("link", { name: /タスク/ }).getAttribute("href")).toBe(
      "/app/parent/tasks",
    );
    expect(screen.getByRole("link", { name: /承認/ }).getAttribute("href")).toBe(
      "/app/parent/approve",
    );
    expect(screen.getByRole("link", { name: /子供モード/ }).getAttribute("href")).toBe(
      "/app/parent/child-view",
    );
    expect(screen.getByRole("link", { name: /完了/ }).getAttribute("href")).toBe(
      "/app/parent/completed",
    );
    expect(screen.getByRole("link", { name: /履歴/ }).getAttribute("href")).toBe(
      "/app/parent/history",
    );
    expect(screen.getByRole("link", { name: /ひろば/ }).getAttribute("href")).toBe(
      "/app/parent/gathering",
    );
    expect(screen.getByRole("link", { name: /家族/ }).getAttribute("href")).toBe(
      "/app/parent/family",
    );
  });
});
