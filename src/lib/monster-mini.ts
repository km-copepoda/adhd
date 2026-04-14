import { getMonsterStage } from "./monsters";
import { getXpInfo, REBIRTH_THRESHOLD } from "./evolution";

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

const EGG_BONUS_IMAGE: Record<string, string> = {
  STUDY: "/monsters/egg-study.webp",
  STAMINA: "/monsters/egg-stamina.webp",
  LIFE: "/monsters/egg-life.webp",
};

export function getMonsterMiniData(params: {
  evolutionStage: number;
  evolutionPath: string;
  side: string | null;
  studyPt: number;
  staminaPt: number;
  lifePt: number;
  collectedPaths: string;
  rebirthEggBonus?: string | null;
}): MonsterMiniData {
  const { evolutionStage, evolutionPath, side, studyPt, staminaPt, lifePt, collectedPaths, rebirthEggBonus } = params;
  const isReborn = (JSON.parse(collectedPaths) as string[]).length > 0;
  const monster = getMonsterStage(evolutionStage, evolutionPath, side);
  const xpInfo = getXpInfo(evolutionStage, evolutionPath, studyPt, staminaPt, lifePt, isReborn, rebirthEggBonus);
  
  // 転生後の卵は選択した卵タイプの画像を表示する
  const image = evolutionStage === 0 && rebirthEggBonus && EGG_BONUS_IMAGE[rebirthEggBonus]
    ? EGG_BONUS_IMAGE[rebirthEggBonus]
    : monster.image;

  const stageLabel =
    evolutionStage === 0 ? "たまご" :
    evolutionStage >= 3 ? "最終形態" :
    `stage ${evolutionStage} / 3`;

  return {
    image,
    monsterName: monster.name,
    stageLabel,
    ptCurrent: xpInfo.totalPt,
    ptNeeded: xpInfo.ptNeeded,
    ptToEvolve: xpInfo.xpToEvolve,
    isRebirth: xpInfo.xpToEvolve === null,
    rebirthThreshold: REBIRTH_THRESHOLD,
  };
}
