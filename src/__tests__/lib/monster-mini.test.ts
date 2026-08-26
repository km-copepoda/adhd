import { describe, it, expect } from "vitest";
import { getMonsterMiniData } from "@/lib/monster-mini";
import { REBIRTH_THRESHOLD } from "@/lib/evolution";
import { getMonsterStage } from "@/lib/monsters";

const base = {
  evolutionStage: 1,
  evolutionPath: "STUDY",
  side: null,
  studyPt: 3,
  staminaPt: 1,
  lifePt: 1,
  collectedPaths: "[]",
};

describe("getMonsterMiniData", () => {
  it("stage1 のモンスター名・画像を返す", () => {
    const result = getMonsterMiniData(base);
    expect(result.monsterName).toBe("ラーン");
    expect(result.image).toBe("/monsters/dark/STUDY_ラーン.webp");
  });

  it("stage0（卵）は stageLabel が 'たまご' になる", () => {
    const result = getMonsterMiniData({ ...base, evolutionStage: 0, evolutionPath: "", studyPt: 0, staminaPt: 0, lifePt: 0 });
    expect(result.stageLabel).toBe("たまご");
  });

  it("stage1 は 'stage 1 / 3' になる", () => {
    const result = getMonsterMiniData(base);
    expect(result.stageLabel).toBe("stage 1 / 3");
  });

  it("stage3（最終形態）は 'stageLabel' が '最終形態' になる", () => {
    const result = getMonsterMiniData({ ...base, evolutionStage: 3, evolutionPath: "STUDY_STUDY_STUDY" });
    expect(result.stageLabel).toBe("最終形態");
  });

  it("進化まで必要な pt を計算する", () => {
    // stage1 threshold = 10pt, 現在 5pt → あと 5pt
    const result = getMonsterMiniData({ ...base, studyPt: 3, staminaPt: 1, lifePt: 1 }); // total=5
    expect(result.ptCurrent).toBe(5);
    expect(result.ptToEvolve).toBe(10);
    expect(result.ptNeeded).toBe(5);
    expect(result.isRebirth).toBe(false);
  });

  it("stage3 は isRebirth=true で ptNeeded=null になる", () => {
    const result = getMonsterMiniData({ ...base, evolutionStage: 3, evolutionPath: "STUDY_STUDY_STUDY", studyPt: 5, staminaPt: 0, lifePt: 0 });
    expect(result.isRebirth).toBe(true);
    expect(result.ptNeeded).toBeNull();
    expect(result.rebirthThreshold).toBe(REBIRTH_THRESHOLD);
  });

  it("LIGHT サイドは LIGHT テーブルの画像を返す", () => {
    const result = getMonsterMiniData({ ...base, side: "LIGHT" });
    expect(result.image).toBe("/monsters/light/STUDY_ルミナ.webp");
    expect(result.monsterName).toBe("ルミナ");
  });

  it("collectedPaths が空でない場合は isReborn として孵化閾値 5pt を使う", () => {
    // 転生後の卵: threshold=5
    const result = getMonsterMiniData({
      ...base,
      evolutionStage: 0,
      evolutionPath: "",
      studyPt: 2,
      staminaPt: 0,
      lifePt: 0,
      collectedPaths: '["STUDY"]',
    });
    expect(result.ptToEvolve).toBe(5);
    expect(result.ptNeeded).toBe(3); // 5 - 2
  });
  
  it("rebirthEggBonus=STUDY の場合、stage0 で勉強の卵画像を返す", () => {
    const result = getMonsterMiniData({
      ...base,
      evolutionStage: 0,
      evolutionPath: "",
      studyPt: 0,
      staminaPt: 0,
      lifePt: 0,
      rebirthEggBonus: "STUDY",
    });
    expect(result.image).toBe("/monsters/egg-study.webp");
  });

  it("rebirthEggBonus=STAMINA の場合、stage0 で体力の卵画像を返す", () => {
    const result = getMonsterMiniData({
      ...base,
      evolutionStage: 0,
      evolutionPath: "",
      rebirthEggBonus: "STAMINA",
    });
    expect(result.image).toBe("/monsters/egg-stamina.webp");
  });

  it("rebirthEggBonus=LIFE の場合、stage0 で生活力の卵画像を返す", () => {
    const result = getMonsterMiniData({
      ...base,
      evolutionStage: 0,
      evolutionPath: "",
      rebirthEggBonus: "LIFE",
    });
    expect(result.image).toBe("/monsters/egg-life.webp");
  });

  it("rebirthEggBonus=null の場合、stage0 でデフォルト卵画像を返す", () => {
    const result = getMonsterMiniData({
      ...base,
      evolutionStage: 0,
      evolutionPath: "",
      rebirthEggBonus: null,
    });
    expect(result.image).toBe("/monsters/dark/egg.webp");
  });
  
  it("stage1 移行は rebirthEggBonus があってもモンスター画像を返す", () => {
    const result = getMonsterMiniData({
      ...base,
      rebirthEggBonus: "STUDY",
    });
    expect(result.image).toBe("/monsters/dark/STUDY_ラーン.webp");
  });

  it("monsterSetId='buddha' を渡すと side に関わらず buddha テーマの画像を返す", () => {
    const expected = getMonsterStage(base.evolutionStage, base.evolutionPath, "buddha");
    const result = getMonsterMiniData({
      ...base,
      side: "LIGHT", // side は無視され monsterSetId が優先されるはず
      monsterSetId: "buddha",
    });
    expect(result.image).toBe(expected.image);
    expect(result.monsterName).toBe(expected.name);
    // buddha は dark/light とは異なる画像パスであることの確認（回帰防止）
    expect(result.image).not.toBe("/monsters/dark/STUDY_ラーン.webp");
    expect(result.image).not.toBe("/monsters/light/STUDY_ルミナ.webp");
  });

  it("monsterSetId を渡さない場合は従来通り side によるフォールバック(dark)になる", () => {
    const result = getMonsterMiniData(base); // monsterSetId 省略, side=null
    expect(result.image).toBe("/monsters/dark/STUDY_ラーン.webp");
  });

  it("monsterSetId が null の場合も side によるフォールバックになる（境界値）", () => {
    const result = getMonsterMiniData({
      ...base,
      side: "LIGHT",
      monsterSetId: null,
    });
    expect(result.image).toBe("/monsters/light/STUDY_ルミナ.webp");
    expect(result.monsterName).toBe("ルミナ");
  });

  // ─── Issue #115: buddha テーマの転生卵（いしのたまご）画像 ──────────────
  it("rebirthEggBonus=STAMINA + monsterSetId='buddha' の場合、stage0 でいしのたまご画像を返す", () => {
    const result = getMonsterMiniData({
      ...base,
      evolutionStage: 0,
      evolutionPath: "",
      rebirthEggBonus: "STAMINA",
      monsterSetId: "buddha",
    });
    expect(result.image).toBe("/monsters/buddha/egg-stone.webp");
  });

  it("rebirthEggBonus=null + monsterSetId='buddha'（通常卵）の場合も、stage0 でいしのたまご画像を返す", () => {
    const result = getMonsterMiniData({
      ...base,
      evolutionStage: 0,
      evolutionPath: "",
      rebirthEggBonus: null,
      monsterSetId: "buddha",
    });
    expect(result.image).toBe("/monsters/buddha/egg-stone.webp");
  });

  it("回帰確認: rebirthEggBonus=STUDY + monsterSetId='dark' の場合は従来通り既定の勉強の卵画像を返す", () => {
    const result = getMonsterMiniData({
      ...base,
      evolutionStage: 0,
      evolutionPath: "",
      rebirthEggBonus: "STUDY",
      monsterSetId: "dark",
    });
    expect(result.image).toBe("/monsters/egg-study.webp");
  });

  it("境界値: evolutionStage が 1 以上の場合は monsterSetId='buddha' でも卵画像ではなくモンスター画像を返す", () => {
    const result = getMonsterMiniData({
      ...base,
      evolutionStage: 1,
      rebirthEggBonus: "STUDY",
      monsterSetId: "buddha",
    });
    expect(result.image).not.toBe("/monsters/buddha/egg-stone.webp");
    expect(result.image).toBe(getMonsterStage(1, base.evolutionPath, "buddha").image);
  });
});
