// @vitest-environment jsdom
//
// Issue #140: モンスター図鑑・コレクションアイテムの表示にrubyEnabledを配線する。
// 対象: src/components/child/ZukanContent.tsx → ZukanEvolutionBranch → MonsterImageModal
//
// 前提: /api/monster 系のレスポンスに rubyEnabled が追加される（本Issueで新設。
// API側テストは src/__tests__/api/monster/monster.test.ts 等を参照）。
// ZukanContent が rubyEnabled を ZukanEvolutionBranch に配線し、
// S1/S2/S3 カードのラベル・alt・モーダルの名前と説明が pickRuby で確定した
// かな表記/漢字表記に切り替わることを期待する。
//
// 実装がまだ存在しないため、これらのテストはすべて Red（失敗）になる想定。

import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt?: string }) =>
    React.createElement("img", { src, alt }),
}));

import ZukanContent from "@/components/child/ZukanContent";
import { MONSTER_THEMES } from "@/lib/monsterThemes/index";

const BUDDHA = MONSTER_THEMES.buddha.table;

type MockApiResponse = {
  side: string | null;
  collectedPaths: string;
  monsterLevels: string;
  usedEggBonuses: string;
  monsterSetId: string;
  ownedThemes: string[];
  rubyEnabled?: unknown;
};

function mockFetchOnce(data: MockApiResponse) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(data),
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(window, "localStorage", {
    value: {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    },
    writable: true,
  });
});

describe("ZukanContent: rubyEnabled配線（Issue #140）", () => {
  it("rubyEnabled=true のとき、S1カードのラベル・altがかな表記になり、漢字表記は表示されないこと", async () => {
    mockFetchOnce({
      side: "DARK",
      collectedPaths: '["buddha:STUDY"]',
      monsterLevels: "{}",
      usedEggBonuses: "[]",
      monsterSetId: "buddha",
      ownedThemes: ["buddha"],
      rubyEnabled: true,
    });

    render(<ZukanContent />);
    const panel = await waitFor(() => screen.getByTestId("zukan-theme-panel-buddha"));

    expect(within(panel).getByText(BUDDHA.STUDY.nameKana)).toBeTruthy();
    expect(within(panel).queryByText(BUDDHA.STUDY.name)).toBeNull();
    expect(within(panel).getByAltText(BUDDHA.STUDY.nameKana)).toBeTruthy();
    expect(within(panel).queryByAltText(BUDDHA.STUDY.name)).toBeNull();
  });

  it("rubyEnabled=false のとき、通常表記（漢字）が表示され、かな表記は表示されないこと", async () => {
    mockFetchOnce({
      side: "DARK",
      collectedPaths: '["buddha:STUDY"]',
      monsterLevels: "{}",
      usedEggBonuses: "[]",
      monsterSetId: "buddha",
      ownedThemes: ["buddha"],
      rubyEnabled: false,
    });

    render(<ZukanContent />);
    const panel = await waitFor(() => screen.getByTestId("zukan-theme-panel-buddha"));

    expect(within(panel).getByText(BUDDHA.STUDY.name)).toBeTruthy();
    expect(within(panel).queryByText(BUDDHA.STUDY.nameKana)).toBeNull();
    expect(within(panel).getByAltText(BUDDHA.STUDY.name)).toBeTruthy();
    expect(within(panel).queryByAltText(BUDDHA.STUDY.nameKana)).toBeNull();
  });

  it("境界値: rubyEnabled が未指定(undefined)のとき、trueにフォールバックしてかな表記になること", async () => {
    mockFetchOnce({
      side: "DARK",
      collectedPaths: '["buddha:STUDY"]',
      monsterLevels: "{}",
      usedEggBonuses: "[]",
      monsterSetId: "buddha",
      ownedThemes: ["buddha"],
      // rubyEnabled 未指定
    });

    render(<ZukanContent />);
    const panel = await waitFor(() => screen.getByTestId("zukan-theme-panel-buddha"));

    expect(within(panel).getByText(BUDDHA.STUDY.nameKana)).toBeTruthy();
    expect(within(panel).queryByText(BUDDHA.STUDY.name)).toBeNull();
  });

  it("モーダルの名前・説明もrubyEnabledに応じて切り替わること（rubyEnabled=true）", async () => {
    mockFetchOnce({
      side: "DARK",
      collectedPaths: '["buddha:STUDY"]',
      monsterLevels: "{}",
      usedEggBonuses: "[]",
      monsterSetId: "buddha",
      ownedThemes: ["buddha"],
      rubyEnabled: true,
    });

    render(<ZukanContent />);
    const panel = await waitFor(() => screen.getByTestId("zukan-theme-panel-buddha"));
    fireEvent.click(within(panel).getByAltText(BUDDHA.STUDY.nameKana));

    const overlay = await waitFor(() => screen.getByTestId("monster-modal-overlay"));
    expect(within(overlay).getByText(BUDDHA.STUDY.nameKana)).toBeTruthy();
    expect(within(overlay).queryByText(BUDDHA.STUDY.name)).toBeNull();
    expect(
      within(overlay).getByTestId("monster-modal-description").textContent,
    ).toBe(BUDDHA.STUDY.descriptionKana);
  });

  it("モーダルの名前・説明もrubyEnabledに応じて切り替わること（rubyEnabled=false）", async () => {
    mockFetchOnce({
      side: "DARK",
      collectedPaths: '["buddha:STUDY"]',
      monsterLevels: "{}",
      usedEggBonuses: "[]",
      monsterSetId: "buddha",
      ownedThemes: ["buddha"],
      rubyEnabled: false,
    });

    render(<ZukanContent />);
    const panel = await waitFor(() => screen.getByTestId("zukan-theme-panel-buddha"));
    fireEvent.click(within(panel).getByAltText(BUDDHA.STUDY.name));

    const overlay = await waitFor(() => screen.getByTestId("monster-modal-overlay"));
    expect(within(overlay).getByText(BUDDHA.STUDY.name)).toBeTruthy();
    expect(within(overlay).queryByText(BUDDHA.STUDY.nameKana)).toBeNull();
    expect(
      within(overlay).getByTestId("monster-modal-description").textContent,
    ).toBe(BUDDHA.STUDY.description);
  });
});
