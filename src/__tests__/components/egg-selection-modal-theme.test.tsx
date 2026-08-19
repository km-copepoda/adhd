// @vitest-environment jsdom
//
// Issue #86: 図鑑（Zukan）のテーマ別タブ対応 — EggSelectionModal のテーマ対応
// 対象: src/components/child/EggSelectionModal.tsx（未実装。現状は `side` prop で
// "/monsters/light/egg.webp" | "/monsters/dark/egg.webp" をハードコード分岐している）
//
// 期待するUI契約（implementer 実装時の参照用）:
//  - `side` prop を `monsterSetId: string | null` に置き換える
//  - 「ふつうの卵」(NORMAL) の画像は @/lib/monsterThemes/index の
//    MONSTER_THEMES[monsterSetId].eggImage を使う
//  - monsterSetId が null、または MONSTER_THEMES に存在しないキーの場合は
//    既定の dark テーマ（MONSTER_THEMES.dark.eggImage）にフォールバックする
//    （@/lib/monsters.ts の getMonsterStage と同じフォールバック規約）
//  - STUDY/STAMINA/LIFE ボーナス卵の画像はテーマ非依存のまま変更しない
//
// 実装がまだ存在しないため、これらのテストはすべて Red（失敗）になる想定。

import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt?: string }) =>
    React.createElement("img", { src, alt }),
}));

import EggSelectionModal from "@/components/child/EggSelectionModal";
import { MONSTER_THEMES } from "@/lib/monsterThemes/index";

describe("EggSelectionModal: 現在のテーマの卵画像を表示すること（Issue #86）", () => {
  it("monsterSetId='dark' の場合、ふつうの卵はdarkテーマの卵画像であること", () => {
    render(
      <EggSelectionModal
        monsterSetId="dark"
        loading={false}
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const img = screen.getByAltText("ふつうの卵") as HTMLImageElement;
    expect(img.getAttribute("src")).toBe(MONSTER_THEMES.dark.eggImage);
  });

  it("monsterSetId='light' の場合、ふつうの卵はlightテーマの卵画像であること", () => {
    render(
      <EggSelectionModal
        monsterSetId="light"
        loading={false}
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const img = screen.getByAltText("ふつうの卵") as HTMLImageElement;
    expect(img.getAttribute("src")).toBe(MONSTER_THEMES.light.eggImage);
  });

  it("monsterSetId='buddha' の場合、ふつうの卵はbuddhaテーマの卵画像であること", () => {
    render(
      <EggSelectionModal
        monsterSetId="buddha"
        loading={false}
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const img = screen.getByAltText("ふつうの卵") as HTMLImageElement;
    expect(img.getAttribute("src")).toBe(MONSTER_THEMES.buddha.eggImage);
  });

  it("境界値: monsterSetIdがnullの場合、既定のdarkテーマの卵画像にフォールバックすること", () => {
    render(
      <EggSelectionModal
        monsterSetId={null}
        loading={false}
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const img = screen.getByAltText("ふつうの卵") as HTMLImageElement;
    expect(img.getAttribute("src")).toBe(MONSTER_THEMES.dark.eggImage);
  });

  it("境界値: monsterSetIdが未知のテーマIDの場合、既定のdarkテーマの卵画像にフォールバックすること", () => {
    render(
      <EggSelectionModal
        monsterSetId="nonexistent-theme"
        loading={false}
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const img = screen.getByAltText("ふつうの卵") as HTMLImageElement;
    expect(img.getAttribute("src")).toBe(MONSTER_THEMES.dark.eggImage);
  });
});
