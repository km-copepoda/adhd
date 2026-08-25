// @vitest-environment jsdom
//
// Issue #100: themeIdFromSide(side) のみに頼ると dark/light の2択にしか解決できず、
// monsterSetId（buddha等）が無視されるバグの残存箇所1
// 対象: src/app/app/child/monster/page.tsx
//
// useMonsterStatus() が返す data.monsterSetId を getMonsterStage の第3引数に渡すべきだが、
// 現状は themeIdFromSide(data.side) のみを渡しているため、
// monsterSetId==="buddha" でも dark/light テーブルの画像が表示されてしまう。

import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";

vi.mock("next/image", () => ({
  __esModule: true,
  default: ({ src, alt }: { src: string; alt: string }) => (
    <img src={src} alt={alt} />
  ),
}));

vi.mock("@/components/LoadingSpinner", () => ({
  default: () => <div data-testid="spinner" />,
}));

vi.mock("@/components/child/EggSelectionModal", () => ({
  default: () => <div data-testid="egg-selection-modal" />,
}));

vi.mock("@/components/child/CutsceneOverlay", () => ({
  default: ({ imageSrc, imageAlt }: { imageSrc?: string; imageAlt?: string }) => (
    <div data-testid="cutscene-overlay">
      {imageSrc && <img src={imageSrc} alt={imageAlt} />}
    </div>
  ),
}));

vi.mock("@/components/child/EvolutionProgressCard", () => ({
  default: () => <div data-testid="evolution-progress-card" />,
}));

vi.mock("@/components/child/StreakCard", () => ({
  default: () => <div data-testid="streak-card" />,
}));

vi.mock("@/components/child/ParameterCardList", () => ({
  default: () => <div data-testid="parameter-card-list" />,
}));

import type { MonsterData, StreakData } from "@/hooks/useMonsterStatus";

const mockUseMonsterStatus = vi.fn();
vi.mock("@/hooks/useMonsterStatus", () => ({
  useMonsterStatus: () => mockUseMonsterStatus(),
}));

import MonsterPage from "@/app/app/child/monster/page";

function makeData(overrides: Partial<MonsterData> = {}): MonsterData {
  return {
    name: "たろうのモンスター",
    side: "DARK",
    monsterSetId: "dark",
    evolutionStage: 1,
    evolutionPath: "STUDY",
    collectedPaths: "[]",
    studyPt: 3,
    staminaPt: 0,
    lifePt: 0,
    pendingStudyPt: 0,
    pendingStaminaPt: 0,
    pendingLifePt: 0,
    rebirthPending: false,
    rebirthEggBonus: null,
    ...overrides,
  };
}

const streak: StreakData = {
  currentStreak: 0,
  bestStreak: 0,
  monthlyDays: 0,
  lastAchievedDate: null,
  currentTitle: null,
};

function setupHook(data: MonsterData, hookOverrides: Record<string, unknown> = {}) {
  mockUseMonsterStatus.mockReturnValue({
    data,
    streak,
    loading: false,
    reborn: false,
    setReborn: vi.fn(),
    unlockedAchievement: null,
    setUnlockedAchievement: vi.fn(),
    setData: vi.fn(),
    fetchStatus: vi.fn(),
    ...hookOverrides,
  });
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("子 育成ページ: モンスターテーマ解決（Issue #100）", () => {
  it("monsterSetId が buddha のとき、buddhaテーマの画像が表示される（side は無視される）", async () => {
    // side は DARK のままだが monsterSetId が buddha を優先するべき
    setupHook(makeData({ side: "DARK", monsterSetId: "buddha", evolutionStage: 1, evolutionPath: "STUDY" }));

    render(<MonsterPage />);

    await waitFor(() => {
      const img = screen.getByAltText("文殊丸");
      expect((img as HTMLImageElement).src).toContain("/monsters/buddha/STUDY_");
    });
  });

  it("monsterSetId が dark のとき、darkテーマの画像が表示される（回帰確認）", async () => {
    setupHook(makeData({ side: "DARK", monsterSetId: "dark", evolutionStage: 1, evolutionPath: "STUDY" }));

    render(<MonsterPage />);

    await waitFor(() => {
      const img = screen.getByAltText("ラーン");
      expect((img as HTMLImageElement).src).toContain("/monsters/dark/STUDY_");
    });
  });

  it("境界値: monsterSetId が buddha かつ evolutionStage===0（卵）のとき buddha の卵画像が表示される", async () => {
    setupHook(makeData({ side: "LIGHT", monsterSetId: "buddha", evolutionStage: 0, evolutionPath: "", rebirthEggBonus: null }));

    render(<MonsterPage />);

    await waitFor(() => {
      const img = screen.getByAltText("たまご");
      expect((img as HTMLImageElement).src).toContain("/monsters/buddha/egg-stone.webp");
    });
  });
});

describe("子 育成ページ: 転生卵ボーナスのテーマ解決（Issue #115）", () => {
  it.each(["STUDY", "STAMINA", "LIFE"] as const)(
    "rebirthEggBonus=%s かつ monsterSetId が buddha のとき、メインヒーロー画像が buddha のいしのたまごになる",
    async (eggType) => {
      setupHook(
        makeData({
          side: "DARK",
          monsterSetId: "buddha",
          evolutionStage: 0,
          evolutionPath: "",
          rebirthEggBonus: eggType,
          collectedPaths: JSON.stringify(["STUDY"]),
        })
      );

      render(<MonsterPage />);

      await waitFor(() => {
        const img = screen.getByAltText("たまご");
        expect((img as HTMLImageElement).src).toContain("/monsters/buddha/egg-stone.webp");
      });
    }
  );

  it("rebirthEggBonus=STUDY かつ monsterSetId が buddha のとき、転生カットインの卵画像も buddha のいしのたまごになる", async () => {
    setupHook(
      makeData({
        side: "DARK",
        monsterSetId: "buddha",
        evolutionStage: 0,
        evolutionPath: "",
        rebirthEggBonus: "STUDY",
        collectedPaths: JSON.stringify(["STUDY"]),
      }),
      { reborn: true }
    );

    render(<MonsterPage />);

    await waitFor(() => {
      const imgs = screen.getAllByAltText("たまご");
      expect(imgs.length).toBeGreaterThan(0);
      for (const img of imgs) {
        expect((img as HTMLImageElement).src).toContain("/monsters/buddha/egg-stone.webp");
      }
    });
  });

  it("回帰確認: rebirthEggBonus=STUDY かつ monsterSetId が dark のとき、従来通り色卵（egg-study.webp）が表示される", async () => {
    setupHook(
      makeData({
        side: "DARK",
        monsterSetId: "dark",
        evolutionStage: 0,
        evolutionPath: "",
        rebirthEggBonus: "STUDY",
        collectedPaths: JSON.stringify(["STUDY"]),
      })
    );

    render(<MonsterPage />);

    await waitFor(() => {
      const img = screen.getByAltText("たまご");
      expect((img as HTMLImageElement).src).toContain("/monsters/egg-study.webp");
    });
  });

  it("回帰確認: rebirthEggBonus=STUDY かつ monsterSetId が light のとき、従来通り色卵（egg-study.webp）が表示される", async () => {
    setupHook(
      makeData({
        side: "LIGHT",
        monsterSetId: "light",
        evolutionStage: 0,
        evolutionPath: "",
        rebirthEggBonus: "STUDY",
        collectedPaths: JSON.stringify(["STUDY"]),
      })
    );

    render(<MonsterPage />);

    await waitFor(() => {
      const img = screen.getByAltText("たまご");
      expect((img as HTMLImageElement).src).toContain("/monsters/egg-study.webp");
    });
  });
});
