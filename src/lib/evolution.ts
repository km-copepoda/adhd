import type { MonsterPath } from "@/types";

// ─── 進化閾値 ─────────────────────────────────────────
// EVOLUTION_THRESHOLDS[evolutionStage] = そのステージから次に進化するために必要な合計pt
// null = 最終形態（進化しない。代わりにREBIRTH_THRESHOLDで転生判定）
// stage0(卵)→1: 1pt  stage1→2: 10pt  stage2→3(最終): 30pt
export const EVOLUTION_THRESHOLDS: (number | null)[] = [1, 10, 30, null];

// ─── 転生閾値 ─────────────────────────────────────────
// 最終形態（stage 3）でこのptを貯めると卵（stage 0）に転生する
export const REBIRTH_THRESHOLD = 20;

// ─── 転生後の孵化閾値 ────────────────────────────────
// 転生後の卵（collectedPaths.length > 0）はこのptで孵化する（初回の1ptより長い）
export const REBIRTH_EGG_THRESHOLD = 5;

// ─── MIN_EVOLUTION_PROBABILITY ───────────────────────
// 各パスの進化確率の下限（15%）。
// スタミナタスクを全くやらなくても STAMINA 系に進化する可能性を担保する。
// 0ptのパスへの不足分を上位パスから比例的に取ることで、支配パスの60%上限は保たれる。
export const MIN_EVOLUTION_PROBABILITY = 0.15;

// ─── computeEvolutionWeights ──────────────────────────
// dominant パラメータは最大60%の確率、残り40%は2番目・3番目の比率で分配。
// さらに MIN_EVOLUTION_PROBABILITY の下限を各パスに保証する。
export function computeEvolutionWeights(
  studyPt: number,
  staminaPt: number,
  lifePt: number,
): { STUDY: number; STAMINA: number; LIFE: number } {
  const total = studyPt + staminaPt + lifePt;

  if (total === 0) {
    return { STUDY: 1 / 3, STAMINA: 1 / 3, LIFE: 1 / 3 };
  }

  const entries: [MonsterPath, number][] = [
    ["STUDY", studyPt],
    ["STAMINA", staminaPt],
    ["LIFE", lifePt],
  ];
  entries.sort((a, b) => b[1] - a[1]);

  const [first, second, third] = entries;
  const firstProb = Math.min(first[1] / total, 0.6);
  const remaining = 1 - firstProb;

  const secondAndThirdTotal = second[1] + third[1];
  let secondProb: number;
  let thirdProb: number;

  if (secondAndThirdTotal === 0) {
    secondProb = remaining / 2;
    thirdProb = remaining / 2;
  } else {
    secondProb = remaining * (second[1] / secondAndThirdTotal);
    thirdProb = remaining * (third[1] / secondAndThirdTotal);
  }

  const weights = { STUDY: 0, STAMINA: 0, LIFE: 0 };
  weights[first[0]] = firstProb;
  weights[second[0]] = secondProb;
  weights[third[0]] = thirdProb;

  // 下限保証: floor を下回るパスに不足分を補填し、上回るパスから比例的に取る
  // → 支配パスの60%上限はそのまま保たれる
  const floor = MIN_EVOLUTION_PROBABILITY;
  const paths = ["STUDY", "STAMINA", "LIFE"] as MonsterPath[];
  const belowFloor = paths.filter((k) => weights[k] < floor);
  if (belowFloor.length > 0) {
    const totalDeficit = belowFloor.reduce((sum, k) => sum + (floor - weights[k]), 0);
    const aboveFloor = paths.filter((k) => weights[k] > floor);
    const totalAbove = aboveFloor.reduce((sum, k) => sum + (weights[k] - floor), 0);
    for (const k of belowFloor) weights[k] = floor;
    for (const k of aboveFloor) {
      weights[k] -= totalDeficit * ((weights[k] - floor) / totalAbove);
    }
  }

  return weights;
}

// ─── applyEggBonus ─────────────────────────────
// 卵ボーナス: 該当カテゴリの確率を絶対値+20%し、残りを比較縮小して合計1を保つ
// 例: 33%/33%/33% + STUDY -> 53%/23%/23%
export function applyEggBonus(
  weights: { STUDY: number; STAMINA: number; LIFE: number },
  eggBonusCategory: string,
): void {
  if (!(eggBonusCategory in weights)) return;
  const key = eggBonusCategory as MonsterPath;
  const otherSum = 1 - weights[key];
  weights[key] = Math.min(weights[key] + 0.2, 1);
  const remaining = 1 - weights[key];
  const scale = otherSum > 0 ? remaining / otherSum : 0;
  for (const k of ["STUDY", "STAMINA", "LIFE"] as MonsterPath[]) {
    if (k !== key) weights[k] *= scale;
  }
}

// ─── selectEvolutionPath ─────────────────────────────
// 加重乱数でパスを選択する
// eggBonusCategory: 選択した卵カテゴリ。そのカテゴリの確率を絶対値+20%する
export function selectEvolutionPath(
  studyPt: number,
  staminaPt: number,
  lifePt: number,
  eggBonusCategory?: string | null,
): MonsterPath {
  const weights = computeEvolutionWeights(studyPt, staminaPt, lifePt);

  if (eggBonusCategory) {
    applyEggBonus(weights, eggBonusCategory);
  }

  const r = Math.random();
  let cumulative = 0;

  for (const path of ["STUDY", "STAMINA", "LIFE"] as MonsterPath[]) {
    cumulative += weights[path];
    if (r < cumulative) return path;
  }

  return "LIFE"; // 丸め誤差フォールバック
}

// ─── checkEvolution ───────────────────────────────────
// 進化チェック。進化した場合はパラメータをリセットし新パスを返す。
// 全ステージ（孵化含む）で加重乱数によるパス選択を行い、evolutionPath に追記する。
export function checkEvolution(
  evolutionStage: number,
  evolutionPath: string,
  studyPt: number,
  staminaPt: number,
  lifePt: number,
  isReborn = false,
  eggBonusCategory?: string | null,
): {
  evolved: boolean;
  reborn: boolean;
  newStage: number;
  newPath: string;
  resetStudy: number;
  resetStamina: number;
  resetLife: number;
} {
  const stageIdx = Math.min(evolutionStage, EVOLUTION_THRESHOLDS.length - 1);
  const baseThreshold = EVOLUTION_THRESHOLDS[stageIdx];
  const threshold = evolutionStage === 0 && isReborn ? REBIRTH_EGG_THRESHOLD : baseThreshold;
  const total = studyPt + staminaPt + lifePt;

  // 最終形態（stage 3）: 転生判定
  if (threshold === null) {
    if (total >= REBIRTH_THRESHOLD) {
      return {
        evolved: false,
        reborn: true,
        newStage: 0,
        newPath: "",
        resetStudy: 0,
        resetStamina: 0,
        resetLife: 0,
      };
    }
    return {
      evolved: false,
      reborn: false,
      newStage: evolutionStage,
      newPath: evolutionPath,
      resetStudy: studyPt,
      resetStamina: staminaPt,
      resetLife: lifePt,
    };
  }

  if (total < threshold) {
    return {
      evolved: false,
      reborn: false,
      newStage: evolutionStage,
      newPath: evolutionPath,
      resetStudy: studyPt,
      resetStamina: staminaPt,
      resetLife: lifePt,
    };
  }

  // 全ステージでパスを選択（孵化時も含む）
  const selected = selectEvolutionPath(studyPt, staminaPt, lifePt, eggBonusCategory);
  const newPath = evolutionPath ? `${evolutionPath}_${selected}` : selected;

  return {
    evolved: true,
    reborn: false,
    newStage: evolutionStage + 1,
    newPath,
    resetStudy: 0,
    resetStamina: 0,
    resetLife: 0,
  };
}

// ─── getXpInfo ────────────────────────────────────────
export function getXpInfo(
  evolutionStage: number,
  evolutionPath: string,
  studyPt: number,
  staminaPt: number,
  lifePt: number,
  isReborn = false,
  eggBonusCategory?: string | null,
) {
  const total = studyPt + staminaPt + lifePt;
  const stageIdx = Math.min(evolutionStage, EVOLUTION_THRESHOLDS.length - 1);
  const baseXp = EVOLUTION_THRESHOLDS[stageIdx];
  const xpToEvolve = evolutionStage === 0 && isReborn ? REBIRTH_EGG_THRESHOLD : baseXp;

  let evolutionWeights: { STUDY: number; STAMINA: number; LIFE: number } | null = null;
  if (xpToEvolve !== null) {
    const weights = computeEvolutionWeights(studyPt, staminaPt, lifePt);
    if (eggBonusCategory) {
      applyEggBonus(weights, eggBonusCategory);
    }
    evolutionWeights = weights;
  }

  return {
    totalPt: total,
    evolutionStage: stageIdx,
    xpInStage: total,
    xpToEvolve,
    ptNeeded: xpToEvolve !== null ? xpToEvolve - total : null,
    evolutionWeights,
  };
}
