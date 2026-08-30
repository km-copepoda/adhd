// @vitest-environment jsdom
//
// Issue #115 → #119: 仏様テーマの転生カテゴリ卵(STUDY/STAMINA/LIFE)は「いしのたまご」で
// 統一する方針だったが、石卵4種が並んで視認性が悪いため方針転換。
// カテゴリ卵(STUDY/STAMINA/LIFE)だけ dark/light と同じ既定の色卵画像に戻す。
// 対象: src/components/child/ZukanEggSection.tsx
//
// 期待するUI契約（implementer 実装時の参照用）:
//  - `monsterSetId: string | null` を props として受け取る（省略可）
//  - STUDY/STAMINA/LIFE の卵画像は @/lib/monsterThemes/eggs の
//    getRebirthEggImage(eggType, monsterSetId) から解決するが、buddha でも
//    DEFAULT_REBIRTH_EGG_IMAGES（既定の色卵）にフォールバックする（Issue #119）
//  - monsterSetId 未指定・null・未知のIDの場合は従来通りの固定パスのまま
//    （dark/light 相当のフォールバック、回帰確認）

import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt?: string }) =>
    React.createElement("img", { src, alt }),
}));

import ZukanEggSection from "@/components/child/ZukanEggSection";

const eggData = { image: "/monsters/dark/egg.webp" };
const usedEggs = new Set<string>(["STUDY", "STAMINA", "LIFE"]);

describe("ZukanEggSection: 転生卵画像のテーマ追従（Issue #115 → #119で色卵に戻す）", () => {
  it("monsterSetId='buddha' の場合、収集済みの勉強/体力/生活力の卵画像は既定の色卵になること（Issue #119: 視認性改善）", () => {
    render(<ZukanEggSection eggData={eggData} usedEggs={usedEggs} monsterSetId="buddha" />);

    expect((screen.getByAltText("📚 勉強の卵") as HTMLImageElement).getAttribute("src")).toBe("/monsters/egg-study.webp");
    expect((screen.getByAltText("💪 体力の卵") as HTMLImageElement).getAttribute("src")).toBe("/monsters/egg-stamina.webp");
    expect((screen.getByAltText("🌿 生活力の卵") as HTMLImageElement).getAttribute("src")).toBe("/monsters/egg-life.webp");
  });

  it("回帰確認: monsterSetId='dark' の場合、収集済みの卵画像は従来通りの固定パスのままであること", () => {
    render(<ZukanEggSection eggData={eggData} usedEggs={usedEggs} monsterSetId="dark" />);

    expect((screen.getByAltText("📚 勉強の卵") as HTMLImageElement).getAttribute("src")).toBe("/monsters/egg-study.webp");
    expect((screen.getByAltText("💪 体力の卵") as HTMLImageElement).getAttribute("src")).toBe("/monsters/egg-stamina.webp");
    expect((screen.getByAltText("🌿 生活力の卵") as HTMLImageElement).getAttribute("src")).toBe("/monsters/egg-life.webp");
  });

  it("境界値: monsterSetId が未指定（省略）でもクラッシュせず、従来通りの固定パスで表示されること", () => {
    render(<ZukanEggSection eggData={eggData} usedEggs={usedEggs} />);

    expect((screen.getByAltText("📚 勉強の卵") as HTMLImageElement).getAttribute("src")).toBe("/monsters/egg-study.webp");
  });

  it("境界値: monsterSetId が null でもクラッシュせず、従来通りの固定パスで表示されること", () => {
    render(<ZukanEggSection eggData={eggData} usedEggs={usedEggs} monsterSetId={null} />);

    expect((screen.getByAltText("📚 勉強の卵") as HTMLImageElement).getAttribute("src")).toBe("/monsters/egg-study.webp");
  });
});
