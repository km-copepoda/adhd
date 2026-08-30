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

// Issue #115 → #119: 仏様テーマの転生カテゴリ卵(STUDY/STAMINA/LIFE)は「いしのたまご」で
// 統一する方針だったが、石卵4種が並んで視認性が悪いため方針転換。
// カテゴリ卵(STUDY/STAMINA/LIFE)だけ dark/light と同じ既定の色卵画像に戻す
// （通常卵＝NORMAL は引き続きいしのたまごのまま）。
// 期待するUI契約（implementer 実装時の参照用）:
//  - 「ふつうの卵」(NORMAL) の画像は引き続き buddha ではいしのたまごのまま
//  - 「勉強の卵」「体力の卵」「生活力の卵」の画像は @/lib/monsterThemes/eggs の
//    getRebirthEggImage(eggType, monsterSetId) から解決するが、buddha でも
//    DEFAULT_REBIRTH_EGG_IMAGES（既定の色卵）にフォールバックする（Issue #119）
//  - dark/light テーマでは従来通りの固定パス（/monsters/egg-study.webp 等）のまま
describe("EggSelectionModal: カテゴリ卵のテーマ追従（Issue #115 → #119で色卵に戻す）", () => {
  it("monsterSetId='buddha' の場合、ふつうの卵(NORMAL)のみいしのたまごであること", () => {
    render(
      <EggSelectionModal
        monsterSetId="buddha"
        loading={false}
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect((screen.getByAltText("ふつうの卵") as HTMLImageElement).getAttribute("src")).toBe(
      "/monsters/buddha/egg-stone.webp"
    );
  });

  it("monsterSetId='buddha' の場合、STUDY/STAMINA/LIFE の卵画像は既定の色卵であること（Issue #119: 視認性改善）", () => {
    render(
      <EggSelectionModal
        monsterSetId="buddha"
        loading={false}
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect((screen.getByAltText("勉強の卵") as HTMLImageElement).getAttribute("src")).toBe("/monsters/egg-study.webp");
    expect((screen.getByAltText("体力の卵") as HTMLImageElement).getAttribute("src")).toBe("/monsters/egg-stamina.webp");
    expect((screen.getByAltText("生活力の卵") as HTMLImageElement).getAttribute("src")).toBe("/monsters/egg-life.webp");
  });

  it("回帰確認: monsterSetId='dark' の場合、STUDY/STAMINA/LIFE の卵画像は従来通りの固定パスのままであること", () => {
    render(
      <EggSelectionModal
        monsterSetId="dark"
        loading={false}
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect((screen.getByAltText("勉強の卵") as HTMLImageElement).getAttribute("src")).toBe("/monsters/egg-study.webp");
    expect((screen.getByAltText("体力の卵") as HTMLImageElement).getAttribute("src")).toBe("/monsters/egg-stamina.webp");
    expect((screen.getByAltText("生活力の卵") as HTMLImageElement).getAttribute("src")).toBe("/monsters/egg-life.webp");
  });

  it("視認性確認: monsterSetId='buddha' の場合、NORMAL/STUDY/STAMINA/LIFE の4つの卵画像パスが互いに異なること（Issue #119の目的）", () => {
    render(
      <EggSelectionModal
        monsterSetId="buddha"
        loading={false}
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const srcs = [
      (screen.getByAltText("ふつうの卵") as HTMLImageElement).getAttribute("src"),
      (screen.getByAltText("勉強の卵") as HTMLImageElement).getAttribute("src"),
      (screen.getByAltText("体力の卵") as HTMLImageElement).getAttribute("src"),
      (screen.getByAltText("生活力の卵") as HTMLImageElement).getAttribute("src"),
    ];

    expect(new Set(srcs).size).toBe(srcs.length);
  });
});
