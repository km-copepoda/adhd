import { describe, it, expect } from "vitest";
import { getMonsterMiniData } from "@/lib/monster-mini";
import { REBIRTH_THRESHOLD } from "@/lib/constants";

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
});
