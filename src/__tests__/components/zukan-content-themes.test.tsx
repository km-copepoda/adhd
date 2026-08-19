// @vitest-environment jsdom
//
// Issue #86: 図鑑（Zukan）のテーマ別タブ対応
// 対象: src/components/child/ZukanContent.tsx（未実装。テーマ別タブ表示はこれから追加される）
//
// 前提: /api/monster のレスポンスに以下の2フィールドが追加される（API側テストは
// src/__tests__/api/monster/monster.test.ts を参照）。
//   - monsterSetId: string   … 現在有効なテーマ
//   - ownedThemes: string[]  … ChildMonsterTheme に記録がある themeId の一覧
//
// 期待するUI契約（implementer 実装時の参照用）:
//  - ownedThemes に含まれる themeId ごとにタブボタンを表示する。
//    `data-testid={`zukan-theme-tab-${themeId}`}`、ラベルは
//    @/lib/monsterThemes/index の MONSTER_THEMES[themeId].label
//  - ownedThemes に含まれない themeId のタブ・紹介カードは一切表示しない
//    （未所持テーマの内容を購入前に見せない、という docs/decisions.md の方針）
//  - 初期選択タブは monsterSetId（ownedThemes に含まれる場合）。含まれない場合は
//    ownedThemes の先頭。
//  - 現在アクティブなタブの内容のみ `data-testid={`zukan-theme-panel-${themeId}`}`
//    でDOMに存在する。非アクティブなタブの内容はDOMに存在しない（アンマウント）。
//  - パネル内のモンスター表・卵は @/lib/monsterThemes/index の
//    MONSTER_THEMES[themeId].table / .eggImage を使う（旧 side ベースの
//    MONSTER_TABLE / MONSTER_TABLE_LIGHT 直接切り替えは廃止）。
//  - ヘッダーの "{total} / {max} 体" は total = collectedPaths の件数
//    （テーマ非依存、全テーマ共通）、max = アクティブテーマの table のキー数（39）。
//  - 未収集モンスターのシルエット画像は、アクティブテーマの table の image パスに対して
//    "/monsters/" → "/monsters/shadow/" 置換したパスになる
//    （table の image が既に "/monsters/{themeId}/..." を含むため、結果として
//    "/monsters/shadow/{themeId}/..." になる）。
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
  // ZukanContent はマウント時に localStorage へ既読件数を書き込む
  Object.defineProperty(window, "localStorage", {
    value: {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    },
    writable: true,
  });
});

describe("ZukanContent: テーマ別タブ対応（Issue #86）", () => {
  it("境界値: 所持テーマが1つ（dark）の場合、タブが1つだけ表示されること", async () => {
    mockFetchOnce({
      side: "DARK",
      collectedPaths: "[]",
      monsterLevels: "{}",
      usedEggBonuses: "[]",
      monsterSetId: "dark",
      ownedThemes: ["dark"],
    });

    render(<ZukanContent />);

    const darkTab = await waitFor(() => screen.getByTestId("zukan-theme-tab-dark"));
    expect(darkTab).toBeTruthy();
    expect(screen.getAllByTestId(/^zukan-theme-tab-/)).toHaveLength(1);
  });

  it("境界値: 所持テーマが1つ（light）の場合、タブが1つだけ表示されること", async () => {
    mockFetchOnce({
      side: "LIGHT",
      collectedPaths: "[]",
      monsterLevels: "{}",
      usedEggBonuses: "[]",
      monsterSetId: "light",
      ownedThemes: ["light"],
    });

    render(<ZukanContent />);

    const lightTab = await waitFor(() => screen.getByTestId("zukan-theme-tab-light"));
    expect(lightTab).toBeTruthy();
    expect(screen.getAllByTestId(/^zukan-theme-tab-/)).toHaveLength(1);
  });

  it("未所持テーマはタブにも紹介カードにも一切表示されないこと", async () => {
    mockFetchOnce({
      side: "DARK",
      collectedPaths: "[]",
      monsterLevels: "{}",
      usedEggBonuses: "[]",
      monsterSetId: "dark",
      ownedThemes: ["dark"],
    });

    render(<ZukanContent />);
    await waitFor(() => screen.getByTestId("zukan-theme-tab-dark"));

    expect(screen.queryByTestId("zukan-theme-tab-light")).toBeNull();
    expect(screen.queryByTestId("zukan-theme-tab-buddha")).toBeNull();
    // ラベル文言も含め一切出ない（紹介カード等も禁止）
    expect(screen.queryByText("ライト")).toBeNull();
    expect(screen.queryByText("仏様")).toBeNull();
  });

  it("複数テーマを所持している場合（過去に切り替えた履歴がある）、すべてタブに表示されること", async () => {
    // monsterSetId は buddha 単体だが、ownedThemes には dark/light/buddha すべてが
    // 含まれる想定（過去に dark → buddha → light … と切り替えた履歴がある場合）。
    // monsterSetId 単体では判定していないことの確認。
    mockFetchOnce({
      side: "DARK",
      collectedPaths: "[]",
      monsterLevels: "{}",
      usedEggBonuses: "[]",
      monsterSetId: "buddha",
      ownedThemes: ["dark", "light", "buddha"],
    });

    render(<ZukanContent />);
    await waitFor(() => screen.getByTestId("zukan-theme-tab-buddha"));

    expect(screen.getByTestId("zukan-theme-tab-dark")).toBeTruthy();
    expect(screen.getByTestId("zukan-theme-tab-light")).toBeTruthy();
    expect(screen.getByTestId("zukan-theme-tab-buddha")).toBeTruthy();
    expect(screen.getAllByTestId(/^zukan-theme-tab-/)).toHaveLength(3);
  });

  it("図鑑の分母(total/max)が表示中タブのテーマ構成(39体)で正しく算出されること", async () => {
    mockFetchOnce({
      side: "DARK",
      collectedPaths: '["STUDY","STAMINA"]',
      monsterLevels: "{}",
      usedEggBonuses: "[]",
      monsterSetId: "dark",
      ownedThemes: ["dark"],
    });

    render(<ZukanContent />);
    await waitFor(() => screen.getByTestId("zukan-theme-tab-dark"));

    expect(screen.getByText("2 / 39 体")).toBeTruthy();
  });

  it("テーマ切替でアクティブタブのパネルがテーマ固有のモンスター表に切り替わること", async () => {
    // STUDY を収集済みとし、dark タブでは「ラーン」、buddha タブでは「文殊丸」が
    // 表示されることを確認する（テーマごとに異なる画像・名前を持つ実データを利用）。
    mockFetchOnce({
      side: "DARK",
      collectedPaths: '["STUDY"]',
      monsterLevels: "{}",
      usedEggBonuses: "[]",
      monsterSetId: "dark",
      ownedThemes: ["dark", "buddha"],
    });

    render(<ZukanContent />);
    const darkPanel = await waitFor(() => screen.getByTestId("zukan-theme-panel-dark"));
    expect(within(darkPanel).getByText("ラーン")).toBeTruthy();
    expect(screen.queryByTestId("zukan-theme-panel-buddha")).toBeNull();

    fireEvent.click(screen.getByTestId("zukan-theme-tab-buddha"));

    const buddhaPanel = await waitFor(() => screen.getByTestId("zukan-theme-panel-buddha"));
    expect(within(buddhaPanel).getByText("文殊丸")).toBeTruthy();
    expect(screen.queryByTestId("zukan-theme-panel-dark")).toBeNull();
  });

  it("未収集モンスターのシルエットがテーマ別パス(/monsters/shadow/{themeId}/)から正しく読み込まれること", async () => {
    // buddha テーマで何も収集していない状態。STUDY(文殊丸)のシルエット画像 src が
    // /monsters/shadow/buddha/... になっていることを確認する。
    mockFetchOnce({
      side: "DARK",
      collectedPaths: "[]",
      monsterLevels: "{}",
      usedEggBonuses: "[]",
      monsterSetId: "buddha",
      ownedThemes: ["buddha"],
    });

    render(<ZukanContent />);
    const panel = await waitFor(() => screen.getByTestId("zukan-theme-panel-buddha"));

    const img = within(panel).getByAltText("文殊丸") as HTMLImageElement;
    expect(img.getAttribute("src")).toBe(
      "/monsters/shadow/buddha/STUDY_もんじゅまる.webp",
    );
  });
});
