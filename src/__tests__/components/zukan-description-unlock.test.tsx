// @vitest-environment jsdom
//
// Issue #94: モンスター図鑑のタップで説明文（description）を表示する（結合テスト）
// 対象: src/components/child/ZukanContent.tsx → ZukanEvolutionBranch → MonsterImageModal
//
// 確定仕様:
//  - 説明文の取得元は monsterTable[path].description（monsterTable = MONSTER_THEMES[activeTheme].table）。
//  - stage1 / stage2（パスのセグメント数 1 または 2）: 収集済みなら無条件で description を表示。
//  - stage3（セグメント数 3）: getMonsterLevel(monsterLevels, themeId, path) で解決した
//    到達回数が S3_DESCRIPTION_UNLOCK_LEVEL(=3) 以上のときのみ description を表示。
//  - 未解放の stage3 は description の代わりに解放条件ヒント（data-testid="monster-modal-locked-hint"）を表示。
//    ヒント文言は description prop には流し込まず、別 prop（lockedHint）経由で渡す。
//  - 親の代理ビューも同一挙動（特別扱いしない）。
//
// 現状 ZukanContent の openModal は { image, name, stageLabel } しか渡していないため、
// description / lockedHint がモーダルに出ず Red になる想定。

import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt?: string }) =>
    React.createElement("img", { src, alt }),
}));

import ZukanContent from "@/components/child/ZukanContent";
import { MONSTER_THEMES } from "@/lib/monsterThemes/index";

const DARK = MONSTER_THEMES.dark.table;
const BUDDHA = MONSTER_THEMES.buddha.table;

type MockApiResponse = {
  side: string | null;
  collectedPaths: string;
  monsterLevels: string;
  usedEggBonuses: string;
  monsterSetId: string;
  ownedThemes: string[];
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

describe("ZukanContent: タップで説明文を表示する（Issue #94）", () => {
  it("収集済み stage1 をタップすると monsterTable[path].description が表示される", async () => {
    mockFetchOnce({
      side: "DARK",
      collectedPaths: '["dark:STUDY"]',
      monsterLevels: "{}",
      usedEggBonuses: "[]",
      monsterSetId: "dark",
      ownedThemes: ["dark"],
    });

    render(<ZukanContent />);
    const panel = await waitFor(() => screen.getByTestId("zukan-theme-panel-dark"));

    fireEvent.click(within(panel).getByAltText("ラーン"));

    const overlay = await waitFor(() => screen.getByTestId("monster-modal-overlay"));
    expect(
      within(overlay).getByTestId("monster-modal-description").textContent,
    ).toBe(DARK["STUDY"].description);
  });

  it("収集済み stage2 をタップすると description が表示される", async () => {
    mockFetchOnce({
      side: "DARK",
      collectedPaths: '["dark:STUDY","dark:STUDY_STAMINA"]',
      monsterLevels: "{}",
      usedEggBonuses: "[]",
      monsterSetId: "dark",
      ownedThemes: ["dark"],
    });

    render(<ZukanContent />);
    const panel = await waitFor(() => screen.getByTestId("zukan-theme-panel-dark"));

    fireEvent.click(within(panel).getByAltText("アーマード"));

    const overlay = await waitFor(() => screen.getByTestId("monster-modal-overlay"));
    expect(
      within(overlay).getByTestId("monster-modal-description").textContent,
    ).toBe(DARK["STUDY_STAMINA"].description);
  });

  it("収集済み stage3 で到達カウントが 3 以上なら description が表示される（境界値: ちょうど 3）", async () => {
    mockFetchOnce({
      side: "DARK",
      collectedPaths:
        '["dark:STUDY","dark:STUDY_STUDY","dark:STUDY_STUDY_STUDY"]',
      // テーマ名前空間付きキーで到達カウント 3 を記録
      monsterLevels: '{"dark:STUDY_STUDY_STUDY":3}',
      usedEggBonuses: "[]",
      monsterSetId: "dark",
      ownedThemes: ["dark"],
    });

    render(<ZukanContent />);
    const panel = await waitFor(() => screen.getByTestId("zukan-theme-panel-dark"));

    fireEvent.click(within(panel).getByAltText("ウィズダム"));

    const overlay = await waitFor(() => screen.getByTestId("monster-modal-overlay"));
    expect(
      within(overlay).getByTestId("monster-modal-description").textContent,
    ).toBe(DARK["STUDY_STUDY_STUDY"].description);
    expect(within(overlay).queryByTestId("monster-modal-locked-hint")).toBeNull();
  });

  it("収集済み stage3 で到達カウントが 3 未満なら description は出ず、解放条件ヒントが表示される（境界値: 2）", async () => {
    mockFetchOnce({
      side: "DARK",
      collectedPaths:
        '["dark:STUDY","dark:STUDY_STUDY","dark:STUDY_STUDY_STUDY"]',
      monsterLevels: '{"dark:STUDY_STUDY_STUDY":2}',
      usedEggBonuses: "[]",
      monsterSetId: "dark",
      ownedThemes: ["dark"],
    });

    render(<ZukanContent />);
    const panel = await waitFor(() => screen.getByTestId("zukan-theme-panel-dark"));

    fireEvent.click(within(panel).getByAltText("ウィズダム"));

    const overlay = await waitFor(() => screen.getByTestId("monster-modal-overlay"));
    // 説明文そのものは表示されない
    expect(within(overlay).queryByTestId("monster-modal-description")).toBeNull();
    expect(
      within(overlay).queryByText(DARK["STUDY_STUDY_STUDY"].description),
    ).toBeNull();
    // 代わりに解放条件ヒントが表示される
    expect(within(overlay).getByTestId("monster-modal-locked-hint")).toBeTruthy();
  });

  it("未収集モンスターはタップしてもモーダルが開かない（既存挙動の回帰防止）", async () => {
    mockFetchOnce({
      side: "DARK",
      collectedPaths: "[]",
      monsterLevels: "{}",
      usedEggBonuses: "[]",
      monsterSetId: "dark",
      ownedThemes: ["dark"],
    });

    render(<ZukanContent />);
    const panel = await waitFor(() => screen.getByTestId("zukan-theme-panel-dark"));

    fireEvent.click(within(panel).getByAltText("ラーン"));

    expect(screen.queryByTestId("monster-modal-overlay")).toBeNull();
  });

  it("テーマタブ切り替えで、そのテーマのテーブルの description が表示される（dark と buddha で文言が異なる）", async () => {
    mockFetchOnce({
      side: "DARK",
      collectedPaths: '["dark:STUDY","buddha:STUDY"]',
      monsterLevels: "{}",
      usedEggBonuses: "[]",
      monsterSetId: "dark",
      ownedThemes: ["dark", "buddha"],
    });

    render(<ZukanContent />);
    const darkPanel = await waitFor(() => screen.getByTestId("zukan-theme-panel-dark"));

    fireEvent.click(within(darkPanel).getByAltText("ラーン"));
    let overlay = await waitFor(() => screen.getByTestId("monster-modal-overlay"));
    expect(
      within(overlay).getByTestId("monster-modal-description").textContent,
    ).toBe(DARK["STUDY"].description);

    // モーダルを閉じる（オーバーレイクリック = onClose）
    fireEvent.click(overlay);
    await waitFor(() =>
      expect(screen.queryByTestId("monster-modal-overlay")).toBeNull(),
    );

    // buddha タブへ切り替え
    fireEvent.click(screen.getByTestId("zukan-theme-tab-buddha"));
    const buddhaPanel = await waitFor(() =>
      screen.getByTestId("zukan-theme-panel-buddha"),
    );

    fireEvent.click(within(buddhaPanel).getByAltText("文殊丸"));
    overlay = await waitFor(() => screen.getByTestId("monster-modal-overlay"));
    expect(
      within(overlay).getByTestId("monster-modal-description").textContent,
    ).toBe(BUDDHA["STUDY"].description);
    // dark と buddha で文言が異なることを前提とした検証
    expect(BUDDHA["STUDY"].description).not.toBe(DARK["STUDY"].description);
  });

  it("親の代理ビュー（fetchUrl 指定）でも同じ解放条件が適用される", async () => {
    mockFetchOnce({
      side: "DARK",
      collectedPaths:
        '["dark:STUDY","dark:STUDY_STUDY","dark:STUDY_STUDY_STUDY"]',
      monsterLevels: '{"dark:STUDY_STUDY_STUDY":2}',
      usedEggBonuses: "[]",
      monsterSetId: "dark",
      ownedThemes: ["dark"],
    });

    render(
      <ZukanContent
        fetchUrl="/api/parent/child-view/monster?childId=abc"
        trackVisit={false}
      />,
    );
    const panel = await waitFor(() => screen.getByTestId("zukan-theme-panel-dark"));

    fireEvent.click(within(panel).getByAltText("ウィズダム"));

    const overlay = await waitFor(() => screen.getByTestId("monster-modal-overlay"));
    // 代理ビューでも未解放 stage3 は description ではなくヒント
    expect(within(overlay).queryByTestId("monster-modal-description")).toBeNull();
    expect(within(overlay).getByTestId("monster-modal-locked-hint")).toBeTruthy();
  });
});
