import { getMonsterStage, getXpInfo, REBIRTH_THRESHOLD } from "./constants";

export type MonsterMiniData = {
  image: string;
  monsterName: string;
  stageLabel: string;
  ptCurrent: number;
  ptNeeded: number | null;
  ptToEvolve: number | null;
  isRebirth: boolean;
  rebirthThreshold: number;
};

export function getMonsterMiniData(params: {
  evolutionStage: number;
  evolutionPath: string;
  side: string | null;
  studyPt: number;
  staminaPt: number;
  lifePt: number;
  collectedPaths: string;
}): MonsterMiniData {
  const { evolutionStage, evolutionPath, side, studyPt, staminaPt, lifePt, collectedPaths } = params;
  const isReborn = (JSON.parse(collectedPaths) as string[]).length > 0;
  const monster = getMonsterStage(evolutionStage, evolutionPath, side);
  const xpInfo = getXpInfo(evolutionStage, evolutionPath, studyPt, staminaPt, lifePt, isReborn);

  const stageLabel =
    evolutionStage === 0 ? "たまご" :
    evolutionStage >= 3 ? "最終形態" :
    `stage ${evolutionStage} / 3`;

  return {
    image: monster.image,
    monsterName: monster.name,
    stageLabel,
    ptCurrent: xpInfo.totalPt,
    ptNeeded: xpInfo.ptNeeded,
    ptToEvolve: xpInfo.xpToEvolve,
    isRebirth: xpInfo.xpToEvolve === null,
    rebirthThreshold: REBIRTH_THRESHOLD,
  };
}
