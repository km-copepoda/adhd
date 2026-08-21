// Issue #73: モンスターテーマセット Stage1 — getMonsterStage のテーマ対応テスト。
// 対象: src/lib/monsters.ts の getMonsterStage シグネチャ変更
//   旧: getMonsterStage(evolutionStage, evolutionPath, side?: "DARK" | "LIGHT" | null)
//   新: getMonsterStage(evolutionStage, evolutionPath, themeId?: string | null)
//       themeId は "dark" / "light" / "buddha" などテーマレジストリのキー文字列。
//
// 既存の side ベースのテスト（src/__tests__/lib/constants.test.ts）は
// 旧シグネチャに依存しているため、implementer がシグネチャ変更時に合わせて
// 更新すること（本ファイルの責務は新シグネチャの検証のみ）。
//
// ─── getMonsterStage 呼び出し元一覧（grep -rn "getMonsterStage" src 結果、2026-08時点）───
//   - src/lib/approve.ts:163
//   - src/lib/streak.ts:127
//   - src/lib/loginStreak.ts:131
//   - src/lib/monster-mini.ts:33
//   - src/app/api/gathering/current/route.ts:73
//   - src/app/app/child/monster/page.tsx:76, 97
//   - src/app/app/parent/(app)/family/page.tsx:344
//   - src/components/child/MonsterCutsceneListener.tsx:40
//   - src/components/parent/ChildViewMonsterCutsceneListener.tsx:39
// 上記すべてを user.monsterSetId (themeId) を渡す形に更新すること（実装時に見落とし注意）。

import { describe, it, expect } from "vitest";
import { getMonsterStage, getEvolutionChildren, MONSTER_TABLE, MONSTER_TABLE_LIGHT } from "@/lib/monsters";
import { MONSTER_TABLE as BUDDHA_TABLE } from "@/lib/monsterThemes/buddha";

describe("getMonsterStage (themeId 対応)", () => {
  it("themeId 未設定（null）は既定の dark テーブルを返すこと（後方互換）", () => {
    const stage = getMonsterStage(1, "STUDY", null);
    expect(stage.image).toBe(MONSTER_TABLE["STUDY"].image);
    expect(stage.name).toBe(MONSTER_TABLE["STUDY"].name);
  });

  it("themeId='dark' は明示的に dark テーブルを返すこと", () => {
    const stage = getMonsterStage(1, "STUDY", "dark");
    expect(stage.image).toBe(MONSTER_TABLE["STUDY"].image);
    expect(stage.name).toBe(MONSTER_TABLE["STUDY"].name);
  });

  it("themeId='light' は従来の side=LIGHT 相当と同じ画像・名前を返すこと（退行防止）", () => {
    const stage = getMonsterStage(1, "STUDY", "light");
    expect(stage.image).toBe(MONSTER_TABLE_LIGHT["STUDY"].image);
    expect(stage.name).toBe(MONSTER_TABLE_LIGHT["STUDY"].name);
  });

  it("themeId='buddha' は buddha テーブルの画像・名前を返すこと", () => {
    const stage = getMonsterStage(1, "STUDY", "buddha");
    expect(stage.image).toBe(BUDDHA_TABLE["STUDY"].image);
    expect(stage.name).toBe(BUDDHA_TABLE["STUDY"].name);
  });

  it("stage2 の複合パスでも themeId='buddha' が反映されること", () => {
    const stage = getMonsterStage(2, "STUDY_STAMINA", "buddha");
    expect(stage.image).toBe(BUDDHA_TABLE["STUDY_STAMINA"].image);
    expect(stage.name).toBe(BUDDHA_TABLE["STUDY_STAMINA"].name);
  });

  it("stage3 の複合パスでも themeId='buddha' が反映されること", () => {
    const stage = getMonsterStage(3, "STUDY_STAMINA_LIFE", "buddha");
    expect(stage.image).toBe(BUDDHA_TABLE["STUDY_STAMINA_LIFE"].image);
  });

  it("stage=0（卵）で themeId='buddha' なら buddha 固有の卵画像を返すこと", () => {
    const stage = getMonsterStage(0, "", "buddha");
    expect(stage.image).toBe("/monsters/buddha/egg.webp");
  });

  it("stage=0（卵）で themeId='light' なら light 固有の卵画像を返すこと", () => {
    const stage = getMonsterStage(0, "", "light");
    expect(stage.image).toBe("/monsters/light/egg.webp");
  });

  it("存在しない themeId は例外を投げないこと", () => {
    expect(() => getMonsterStage(1, "STUDY", "nonexistent-theme")).not.toThrow();
  });

  it("存在しない themeId は既定テーブル（dark）にフォールバックすること", () => {
    const stage = getMonsterStage(1, "STUDY", "nonexistent-theme");
    expect(stage.image).toBe(MONSTER_TABLE["STUDY"].image);
    expect(stage.name).toBe(MONSTER_TABLE["STUDY"].name);
  });

  it("空文字の themeId も例外を投げず既定テーブル（dark）にフォールバックすること", () => {
    expect(() => getMonsterStage(1, "STUDY", "")).not.toThrow();
    const stage = getMonsterStage(1, "STUDY", "");
    expect(stage.image).toBe(MONSTER_TABLE["STUDY"].image);
  });
});

describe("getEvolutionChildren（テーマ導入後も不変であること）", () => {
  it("空文字列（卵）はStage1の3体を返すこと", () => {
    expect(getEvolutionChildren("").sort()).toEqual(["LIFE", "STAMINA", "STUDY"]);
  });

  it("Stage1パス（STUDY）はStage2の3体を返すこと", () => {
    expect(getEvolutionChildren("STUDY").sort()).toEqual(["STUDY_LIFE", "STUDY_STAMINA", "STUDY_STUDY"]);
  });

  it("Stage3パスは空配列（最終形態）を返すこと", () => {
    expect(getEvolutionChildren("STUDY_STAMINA_LIFE")).toEqual([]);
  });
});
