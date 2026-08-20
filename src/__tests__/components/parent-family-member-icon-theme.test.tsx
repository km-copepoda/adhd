// @vitest-environment jsdom
//
// Issue #100: themeIdFromSide(side) のみに頼ると dark/light の2択にしか解決できず、
// monsterSetId（buddha等）が無視されるバグの残存箇所2
// 対象: src/app/app/parent/(app)/family/page.tsx（メンバー一覧のモンスターアイコン部分）
//
// member.monsterSetId が既にレスポンスに含まれているにもかかわらず、
// アイコン描画では themeIdFromSide(member.side) のみを getMonsterStage に渡しているため、
// monsterSetId==="buddha" のメンバーでも dark/light テーブルの画像が表示されてしまう。

import { render, screen, waitFor } from "@testing-library/react";
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
  default: ({ src, alt }: { src: string; alt?: string }) => (
    <img src={src} alt={alt} />
  ),
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
  monsterSetId: string;
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
    ownedThemes: ["dark", "light", "buddha"],
    ...overrides,
  };
}

function mockFetchWithMembers(members: MockMember[]) {
  global.fetch = vi.fn().mockImplementation((url: string) => {
    if (url.includes("/api/family/code")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ code: "ABC123", members }),
      });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  }) as unknown as typeof fetch;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("親 ファミリーページ: メンバー一覧のモンスターアイコン テーマ解決（Issue #100）", () => {
  it("monsterSetId が buddha のメンバーは、buddhaテーマの画像がアイコンに表示される（side は無視される）", async () => {
    // side は DARK のままだが monsterSetId が buddha を優先するべき
    mockFetchWithMembers([
      makeChild({ side: "DARK", monsterSetId: "buddha", evolutionStage: 1, evolutionPath: "STUDY" }),
    ]);

    render(<FamilyPage />);

    await waitFor(() => {
      const img = screen.getByAltText("文殊丸");
      expect((img as HTMLImageElement).src).toContain("/monsters/buddha/STUDY_");
    });
  });

  it("monsterSetId が dark のメンバーは、darkテーマの画像がアイコンに表示される（回帰確認）", async () => {
    mockFetchWithMembers([
      makeChild({ side: "DARK", monsterSetId: "dark", evolutionStage: 1, evolutionPath: "STUDY" }),
    ]);

    render(<FamilyPage />);

    await waitFor(() => {
      const img = screen.getByAltText("ラーン");
      expect((img as HTMLImageElement).src).toContain("/monsters/dark/STUDY_");
    });
  });

  it("境界値: monsterSetId が buddha かつ evolutionStage===0（卵）のとき buddha の卵画像が表示される", async () => {
    mockFetchWithMembers([
      makeChild({ side: "LIGHT", monsterSetId: "buddha", evolutionStage: 0, evolutionPath: "", rebirthEggBonus: null }),
    ]);

    render(<FamilyPage />);

    await waitFor(() => {
      const img = screen.getByAltText("たまご");
      expect((img as HTMLImageElement).src).toContain("/monsters/buddha/egg.webp");
    });
  });
});
