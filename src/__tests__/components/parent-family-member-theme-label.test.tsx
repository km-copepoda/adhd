// @vitest-environment jsdom
//
// Issue #262: ファミリー一覧の「冒険者」ラベルを side ではなく monsterSetId 由来にする
// 対象: src/app/app/parent/(app)/family/page.tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { signOut: vi.fn().mockResolvedValue({}) },
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
    })),
    removeChannel: vi.fn(),
  }),
}));

vi.mock("next/image", () => ({
  __esModule: true,
  default: ({ src, alt }: { src: string; alt?: string }) => <img src={src} alt={alt} />,
}));

vi.mock("@/components/LoadingSpinner", () => ({
  default: () => <div data-testid="spinner" />,
}));

import FamilyPage from "@/app/app/parent/(app)/family/page";

type MockMember = {
  id: string;
  name: string;
  role: "PARENT" | "CHILD";
  side: string | null;
  monsterName: string | null;
  evolutionStage: number;
  evolutionPath: string;
  rebirthEggBonus: string | null;
  rebirthPending: boolean;
  childCode: string | null;
  minTasksForStreak: number;
  reportDeadlineTime: string | null;
  checkinDeadlineTime: string | null;
  questTimeNotifyEnabled: boolean;
  studyPt: number;
  staminaPt: number;
  lifePt: number;
  collectedPaths: string;
  monsterSetId: string | null;
  pendingMonsterSetId: string | null;
  ownedThemes: string[];
};

function makeChild(overrides: Partial<MockMember> = {}): MockMember {
  return {
    id: "child-1",
    name: "たろう",
    role: "CHILD",
    side: "DARK",
    monsterName: "たろうのモンスター",
    evolutionStage: 1,
    evolutionPath: "STUDY",
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
    ownedThemes: ["dark", "light", "buddha", "yokai", "railway"],
    ...overrides,
  };
}

function mockFetch(members: MockMember[], patch?: () => Promise<unknown>) {
  global.fetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
    if (url.includes("/api/family/code")) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ code: "ABC123", members }) });
    }
    if (url.includes("/monster-theme") && options?.method === "PATCH" && patch) {
      return patch();
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  }) as unknown as typeof fetch;
}

async function label(id: string) {
  return screen.findByTestId(`member-theme-label-${id}`);
}

function memberImg(id: string): HTMLImageElement {
  return screen.getByTestId(`member-${id}`).querySelector("img") as HTMLImageElement;
}

afterEach(() => vi.clearAllMocks());

describe("親 ファミリーページ: メンバーのテーマラベル（Issue #262）", () => {
  it("side=DARK でも monsterSetId=light なら「🎨 ライト」で「かっこいい」は出ない", async () => {
    mockFetch([makeChild({ side: "DARK", monsterSetId: "light" })]);
    render(<FamilyPage />);
    const el = await label("child-1");
    expect(el.textContent).toContain("🎨");
    expect(el.textContent).toContain("ライト");
    expect(screen.queryByText(/かっこいい/)).toBeNull();
    expect(screen.queryByText(/かわいい/)).toBeNull();
  });

  it("side=null でも monsterSetId=buddha なら「仏様」が出る", async () => {
    mockFetch([makeChild({ side: null, monsterSetId: "buddha" })]);
    render(<FamilyPage />);
    expect((await label("child-1")).textContent).toContain("仏様");
  });

  it("予約中（dark + pending yokai）はラベルが現在テーマの「ダーク」", async () => {
    mockFetch([makeChild({ monsterSetId: "dark", pendingMonsterSetId: "yokai" })]);
    render(<FamilyPage />);
    const el = await label("child-1");
    expect(el.textContent).toContain("ダーク");
    expect(el.textContent).not.toContain("妖怪");
  });

  it("未知の monsterSetId はラベル「ダーク」かつアイコンも dark", async () => {
    mockFetch([makeChild({ monsterSetId: "no-such-theme" })]);
    render(<FamilyPage />);
    expect((await label("child-1")).textContent).toContain("ダーク");
    expect(memberImg("child-1").src).toContain("/monsters/dark/");
  });

  it("プロトタイプ上のキー（toString）でもラベル「ダーク」・アイコン dark", async () => {
    mockFetch([makeChild({ monsterSetId: "toString" })]);
    render(<FamilyPage />);
    expect((await label("child-1")).textContent).toContain("ダーク");
    expect(memberImg("child-1").src).toContain("/monsters/dark/");
  });

  it("monsterSetId が null の場合は side 由来の dark にフォールバックしラベルは「ダーク」", async () => {
    mockFetch([makeChild({ side: "DARK", monsterSetId: null })]);
    render(<FamilyPage />);
    expect((await label("child-1")).textContent).toContain("ダーク");
  });

  it("親は「管理者」でテーマラベルなし", async () => {
    mockFetch([makeChild({ id: "parent-1", name: "おや", role: "PARENT", monsterName: null })]);
    render(<FamilyPage />);
    await screen.findByText("管理者");
    expect(screen.queryByTestId("member-theme-label-parent-1")).toBeNull();
  });

  it("子が複数いるとき、それぞれ別のラベルになる", async () => {
    mockFetch([
      makeChild({ id: "c1", monsterSetId: "light" }),
      makeChild({ id: "c2", name: "はなこ", monsterName: "はなこのモンスター", monsterSetId: "railway" }),
    ]);
    render(<FamilyPage />);
    expect((await label("c1")).textContent).toContain("ライト");
    expect((await label("c2")).textContent).toContain("電車");
  });

  it("セレクターで即時切り替えすると、アイコンとラベルがともに新テーマ（電車）になる", async () => {
    mockFetch([makeChild({ evolutionStage: 0, evolutionPath: "", monsterSetId: "dark" })], () =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ immediate: true, monsterSetId: "railway" }),
      })
    );
    render(<FamilyPage />);
    expect((await label("child-1")).textContent).toContain("ダーク");
    fireEvent.change(screen.getByTestId("monster-theme-select-child-1"), { target: { value: "railway" } });
    await waitFor(() => {
      expect(screen.getByTestId("member-theme-label-child-1").textContent).toContain("電車");
    });
    expect(memberImg("child-1").src).toContain("/monsters/railway/");
    const calls = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls;
    const patchCall = calls.find(([, o]) => o?.method === "PATCH");
    expect(JSON.parse(patchCall![1].body)).toEqual({ themeId: "railway" });
  });

  it("予約レスポンス後もアイコンとラベルは現在テーマのまま", async () => {
    mockFetch([makeChild({ monsterSetId: "dark" })], () =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ immediate: false, pendingMonsterSetId: "railway" }),
      })
    );
    render(<FamilyPage />);
    await label("child-1");
    fireEvent.change(screen.getByTestId("monster-theme-select-child-1"), { target: { value: "railway" } });
    await screen.findByText("次の転生からこのテーマになります");
    const el = screen.getByTestId("member-theme-label-child-1");
    expect(el.textContent).toContain("ダーク");
    expect(el.textContent).not.toContain("電車");
    expect(memberImg("child-1").src).toContain("/monsters/dark/");
  });

  it("PATCH 失敗時はアイコンとラベルが変わらない", async () => {
    mockFetch([makeChild({ monsterSetId: "dark", evolutionStage: 0, evolutionPath: "" })], () =>
      Promise.resolve({ ok: false, json: () => Promise.resolve({ error: "失敗しました" }) })
    );
    render(<FamilyPage />);
    await label("child-1");
    fireEvent.change(screen.getByTestId("monster-theme-select-child-1"), { target: { value: "railway" } });
    await screen.findByText("失敗しました");
    expect(screen.getByTestId("member-theme-label-child-1").textContent).toContain("ダーク");
    expect(memberImg("child-1").src).toContain("/monsters/dark/");
  });
});
