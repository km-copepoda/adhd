// @vitest-environment jsdom
// Issue #190: 報告期限・チェックイン締切の保存が res.ok を見ず、失敗しても成功扱いになる
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { signOut: vi.fn().mockResolvedValue({}) },
    channel: vi.fn(() => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn() })),
    removeChannel: vi.fn(),
  }),
}));
vi.mock("next/image", () => ({
  default: ({ alt }: { alt?: string }) => React.createElement("img", { alt }),
}));
vi.mock("@/components/LoadingSpinner", () => ({
  default: () => React.createElement("div", { "data-testid": "spinner" }),
}));

import FamilyPage from "@/app/app/parent/(app)/family/page";

const CHILD = {
  id: "child-1",
  name: "たろう",
  role: "CHILD",
  side: "LIGHT",
  monsterName: "たろうのモンスター",
  evolutionStage: 0,
  evolutionPath: "",
  rebirthEggBonus: null,
  rebirthPending: false,
  childCode: "1234",
  minTasksForStreak: 1,
  reportDeadlineTime: null,
  checkinDeadlineTime: null,
  questTimeNotifyEnabled: true,
  studyPt: 0,
  staminaPt: 0,
  lifePt: 0,
  collectedPaths: "[]",
  monsterSetId: "dark",
  pendingMonsterSetId: null,
  ownedThemes: ["dark"],
};

function mockFetch(patch: () => Promise<unknown>) {
  const fn = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    if (url.includes("/api/family/code")) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ code: "ABC123", members: [CHILD] }) });
    }
    if (url.includes("/api/family/settings") && init?.method === "PATCH") return patch();
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });
  global.fetch = fn as unknown as typeof fetch;
  return fn;
}

async function setup(patch: () => Promise<unknown>) {
  mockFetch(patch);
  const { container } = render(<FamilyPage />);
  await waitFor(() => expect(container.querySelectorAll('input[type="time"]').length).toBe(2));
  const times = container.querySelectorAll('input[type="time"]');
  const saves = screen.getAllByRole("button", { name: "保存" });
  return { times, saves };
}

describe("親 ファミリーページ: 期限保存の失敗処理 (#190)", () => {
  afterEach(() => vi.clearAllMocks());

  it("報告期限の保存が 500 のときエラーを表示する", async () => {
    const { times, saves } = await setup(() => Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) }));
    fireEvent.change(times[0], { target: { value: "20:00" } });
    fireEvent.click(saves[0]);
    expect(await screen.findByText(/報告期限を保存できませんでした/)).toBeTruthy();
  });

  it("報告期限の保存で fetch が reject してもエラー表示になり保存中のまま固まらない", async () => {
    const { times, saves } = await setup(() => Promise.reject(new Error("offline")));
    fireEvent.change(times[0], { target: { value: "20:00" } });
    fireEvent.click(saves[0]);
    expect(await screen.findByText(/報告期限を保存できませんでした/)).toBeTruthy();
    expect(screen.queryByText("保存中...")).toBeNull();
  });

  it("チェックイン締切の保存が失敗したときエラーを表示し、保存済み値(state)を更新しない", async () => {
    const { times, saves } = await setup(() => Promise.resolve({ ok: false, status: 400, json: () => Promise.resolve({}) }));
    fireEvent.change(times[1], { target: { value: "07:30" } });
    fireEvent.click(saves[1]);
    expect(await screen.findByText(/チェックイン締切を保存できませんでした/)).toBeTruthy();
  });

  it("保存が成功したときはエラーを表示しない（境界: 200）", async () => {
    const { times, saves } = await setup(() => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) }));
    fireEvent.change(times[0], { target: { value: "20:00" } });
    fireEvent.click(saves[0]);
    await waitFor(() => expect(screen.queryByText("保存中...")).toBeNull());
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
