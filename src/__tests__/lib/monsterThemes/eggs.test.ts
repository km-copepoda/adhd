// Issue #115: 仏様テーマの転生卵を「いしのたまご」にし、卵画像をテーマ追従させる。
// Issue #119: ↑の方針転換。石卵4種が並んで視認性が悪いため、カテゴリ卵
// （STUDY/STAMINA/LIFE）だけ dark/light と同じ既定の色卵画像に戻す
// （通常卵＝いしのたまごは維持）。
// 対象: src/lib/monsterThemes/eggs.ts / src/lib/monsterThemes/index.ts
//
// getRebirthEggImage(eggType, monsterSetId) は転生卵選択ボーナス（STUDY/STAMINA/LIFE）
// の画像パスを、有効なモンスターテーマセットに応じて解決する純粋関数。
// - buddha テーマでも STUDY/STAMINA/LIFE は既定の色卵画像（DEFAULT_REBIRTH_EGG_IMAGES）
//   にフォールバックする（dark/light と同じ挙動。Issue #119）。
// - rebirthEggImages を持たないテーマ（dark/light）は既存の既定マップにフォールバックする。
// - eggType が NORMAL・null・undefined・未知の文字列の場合は null を返す
//   （呼び出し側がテーマの通常卵にフォールバックする）。
// - monsterSetId が null・undefined・未知のIDの場合は dark 相当にフォールバックする。

import { describe, it, expect } from "vitest";
import { getRebirthEggImage } from "@/lib/monsterThemes/eggs";

describe("getRebirthEggImage", () => {
  it("STUDY + buddha は既定の勉強の卵画像を返す（Issue #119: 色卵に戻す）", () => {
    expect(getRebirthEggImage("STUDY", "buddha")).toBe("/monsters/egg-study.webp");
  });

  it("STAMINA + buddha は既定の体力の卵画像を返す（Issue #119: 色卵に戻す）", () => {
    expect(getRebirthEggImage("STAMINA", "buddha")).toBe("/monsters/egg-stamina.webp");
  });

  it("LIFE + buddha は既定の生活力の卵画像を返す（Issue #119: 色卵に戻す）", () => {
    expect(getRebirthEggImage("LIFE", "buddha")).toBe("/monsters/egg-life.webp");
  });

  it("STUDY + dark は既存の既定卵画像を返す（後方互換）", () => {
    expect(getRebirthEggImage("STUDY", "dark")).toBe("/monsters/egg-study.webp");
  });

  it("STUDY + light は既存の既定卵画像を返す", () => {
    expect(getRebirthEggImage("STUDY", "light")).toBe("/monsters/egg-study.webp");
  });

  it("STAMINA + light は既存の既定卵画像を返す", () => {
    expect(getRebirthEggImage("STAMINA", "light")).toBe("/monsters/egg-stamina.webp");
  });

  it("LIFE + light は既存の既定卵画像を返す", () => {
    expect(getRebirthEggImage("LIFE", "light")).toBe("/monsters/egg-life.webp");
  });

  it("境界値: eggType が null の場合は null を返す", () => {
    expect(getRebirthEggImage(null, "buddha")).toBeNull();
  });

  it("境界値: eggType が undefined の場合は null を返す", () => {
    expect(getRebirthEggImage(undefined, "buddha")).toBeNull();
  });

  it("境界値: eggType が NORMAL の場合は null を返す", () => {
    expect(getRebirthEggImage("NORMAL", "buddha")).toBeNull();
  });

  it("境界値: eggType が未知の文字列の場合は null を返す", () => {
    expect(getRebirthEggImage("UNKNOWN", "buddha")).toBeNull();
  });

  it("境界値: monsterSetId が null の場合は dark 既定にフォールバックする", () => {
    expect(getRebirthEggImage("STUDY", null)).toBe("/monsters/egg-study.webp");
  });

  it("境界値: monsterSetId が undefined の場合は dark 既定にフォールバックする", () => {
    expect(getRebirthEggImage("STUDY", undefined)).toBe("/monsters/egg-study.webp");
  });

  it("境界値: monsterSetId が未知のテーマIDの場合は例外を投げず dark 既定にフォールバックする", () => {
    expect(() => getRebirthEggImage("STUDY", "unknown-theme")).not.toThrow();
    expect(getRebirthEggImage("STUDY", "unknown-theme")).toBe("/monsters/egg-study.webp");
  });
});
