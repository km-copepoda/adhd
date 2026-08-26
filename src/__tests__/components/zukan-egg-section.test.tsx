// @vitest-environment jsdom
//
// Issue #115: 仏様テーマの転生卵を「いしのたまご」にし、卵画像をテーマ追従させる。
// 対象: src/components/child/ZukanEggSection.tsx（未実装。現状は STUDY/STAMINA/LIFE の
// 卵画像を "/monsters/egg-study.webp" 等の固定パスでハードコードしている）
//
// 期待するUI契約（implementer 実装時の参照用）:
//  - 新たに `monsterSetId: string | null` を props として受け取る（省略可、デフォルトは
//    null 相当のフォールバック動作。既存呼び出し元を壊さないこと）
//  - STUDY/STAMINA/LIFE の卵画像は @/lib/monsterThemes/eggs の
//    getRebirthEggImage(eggType, monsterSetId) から解決する
//  - buddha テーマでは3つとも /monsters/buddha/egg-stone.webp になる
//  - monsterSetId 未指定・null・未知のIDの場合は従来通りの固定パスのまま
//    （dark/light 相当のフォールバック、回帰確認）
//
// 実装がまだ存在しないため、これらのテストはすべて Red（失敗）になる想定。

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

describe("ZukanEggSection: 転生卵画像のテーマ追従（Issue #115）", () => {
  it("monsterSetId='buddha' の場合、収集済みの勉強/体力/生活力の卵画像がすべていしのたまごになること", () => {
    render(<ZukanEggSection eggData={eggData} usedEggs={usedEggs} monsterSetId="buddha" />);

    const stoneEgg = "/monsters/buddha/egg-stone.webp";
    expect((screen.getByAltText("📚 勉強の卵") as HTMLImageElement).getAttribute("src")).toBe(stoneEgg);
    expect((screen.getByAltText("💪 体力の卵") as HTMLImageElement).getAttribute("src")).toBe(stoneEgg);
    expect((screen.getByAltText("🌿 生活力の卵") as HTMLImageElement).getAttribute("src")).toBe(stoneEgg);
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
