import { getMonsterStage, themeIdFromSide } from "./monsters";
import { getXpInfo, REBIRTH_THRESHOLD } from "./evolution";
import { getRebirthEggImage } from "./monsterThemes/eggs";

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
  rebirthEggBonus?: string | null;
  monsterSetId?: string | null;
}): MonsterMiniData {
  const { evolutionStage, evolutionPath, side, studyPt, staminaPt, lifePt, collectedPaths, rebirthEggBonus, monsterSetId } = params;
  const isReborn = (JSON.parse(collectedPaths) as string[]).length > 0;
  const resolvedThemeId = monsterSetId ? monsterSetId : themeIdFromSide(side);
  const monster = getMonsterStage(evolutionStage, evolutionPath, resolvedThemeId);
  const xpInfo = getXpInfo(evolutionStage, evolutionPath, studyPt, staminaPt, lifePt, isReborn, rebirthEggBonus);

  // 転生後の卵は選択した卵タイプの画像（テーマ追従）を表示する。
  // 選択なし（NORMAL/null等）の場合は通常卵（monster.image）にフォールバックする。
  const image = evolutionStage === 0
    ? getRebirthEggImage(rebirthEggBonus, resolvedThemeId) ?? monster.image
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
