import type { Difficulty, Category, MonsterPath } from "@/types";

// XP per difficulty
export const XP_MAP: Record<Difficulty, number> = {
  EASY: 1,
  NORMAL: 3,
  HARD: 5,
};

// Category labels
export const CATEGORY_LABEL: Record<Category, { emoji: string; name: string }> = {
  STUDY: { emoji: "📚", name: "学力" },
  STAMINA: { emoji: "💪", name: "体力" },
  LIFE: { emoji: "🌿", name: "生活力" },
};

// Category colors (Tailwind classes)
export const CATEGORY_COLOR: Record<Category, string> = {
  STUDY: "#60a5fa",
  STAMINA: "#f87171",
  LIFE: "#4ade80",
};

// Difficulty labels
export const DIFFICULTY_LABEL: Record<Difficulty, { name: string; color: string }> = {
  EASY: { name: "かんたん", color: "#5cb85c" },
  NORMAL: { name: "ふつう", color: "#4ecdc4" },
  HARD: { name: "むずかしい", color: "#e05c5c" },
};

// ─── 進化閾値 ─────────────────────────────────────────
// EVOLUTION_THRESHOLDS[evolutionStage] = そのステージから次に進化するために必要な合計pt
// null = 最終形態（進化しない）
export const EVOLUTION_THRESHOLDS: (number | null)[] = [1, 10, 30, 70, null];

// ─── たまご ───────────────────────────────────────────
export const EGG_STAGE = { emoji: "🥚", name: "たまご", ptToEvolve: 1 };

// ─── モンスターテーブル ───────────────────────────────
// キー = 進化パス履歴（"" = stage1ひよこ、"STUDY" = stage2、"STUDY_LIFE" = stage3、等）
// 40体: "" x1, stage2 x3, stage3 x9, stage4 x27
export const MONSTER_TABLE: Record<string, { emoji: string; name: string }> = {
  // Stage 1: ひよこ（共通）
  "": { emoji: "🐣", name: "ひよこ" },

  // Stage 2: 3体
  "STUDY":   { emoji: "🧠", name: "まなびの子" },
  "STAMINA": { emoji: "⚡", name: "きたえの子" },
  "LIFE":    { emoji: "🌱", name: "くらしの子" },

  // Stage 3: 9体 (勉勉, 勉体, 勉生, 体勉, 体体, 体生, 生勉, 生体, 生生)
  "STUDY_STUDY":   { emoji: "📖", name: "秀才" },
  "STUDY_STAMINA": { emoji: "⚔️", name: "文武の士" },
  "STUDY_LIFE":    { emoji: "🌿", name: "賢者の卵" },
  "STAMINA_STUDY": { emoji: "🏋️", name: "武芸学者" },
  "STAMINA_STAMINA": { emoji: "🦁", name: "剛力の獣" },
  "STAMINA_LIFE":  { emoji: "🐗", name: "野生の護衛" },
  "LIFE_STUDY":    { emoji: "🌺", name: "知恵の守り手" },
  "LIFE_STAMINA":  { emoji: "🐯", name: "生命の戦士" },
  "LIFE_LIFE":     { emoji: "🌳", name: "大地の精霊" },

  // Stage 4: 27体 (勉勉勉, 勉勉体, 勉勉生, 勉体勉, ...)
  "STUDY_STUDY_STUDY":   { emoji: "🧙", name: "大賢者" },
  "STUDY_STUDY_STAMINA": { emoji: "🦅", name: "知将" },
  "STUDY_STUDY_LIFE":    { emoji: "🌟", name: "スタースピリット" },
  "STUDY_STAMINA_STUDY": { emoji: "🏰", name: "騎士団長" },
  "STUDY_STAMINA_STAMINA": { emoji: "🐉", name: "ドラゴンナイト" },
  "STUDY_STAMINA_LIFE":  { emoji: "🦊", name: "賢狐の将" },
  "STUDY_LIFE_STUDY":    { emoji: "🌙", name: "月の学者" },
  "STUDY_LIFE_STAMINA":  { emoji: "🦋", name: "変革の翼" },
  "STUDY_LIFE_LIFE":     { emoji: "🌈", name: "虹の賢者" },

  "STAMINA_STUDY_STUDY":   { emoji: "🏹", name: "射撃の名手" },
  "STAMINA_STUDY_STAMINA": { emoji: "⚡", name: "雷神" },
  "STAMINA_STUDY_LIFE":    { emoji: "🌊", name: "海の守護者" },
  "STAMINA_STAMINA_STUDY": { emoji: "🔥", name: "炎の覇者" },
  "STAMINA_STAMINA_STAMINA": { emoji: "👑", name: "武神" },
  "STAMINA_STAMINA_LIFE":  { emoji: "🐺", name: "鋼鉄の狼" },
  "STAMINA_LIFE_STUDY":    { emoji: "🦄", name: "聖なる角" },
  "STAMINA_LIFE_STAMINA":  { emoji: "🐲", name: "生命の龍" },
  "STAMINA_LIFE_LIFE":     { emoji: "🌿", name: "大自然の守人" },

  "LIFE_STUDY_STUDY":   { emoji: "🔮", name: "占い師" },
  "LIFE_STUDY_STAMINA": { emoji: "🌸", name: "花の剣士" },
  "LIFE_STUDY_LIFE":    { emoji: "🍀", name: "四葉の精" },
  "LIFE_STAMINA_STUDY": { emoji: "🐻", name: "森の賢者" },
  "LIFE_STAMINA_STAMINA": { emoji: "🦊", name: "炎の狐" },
  "LIFE_STAMINA_LIFE":  { emoji: "🐸", name: "大地の戦士" },
  "LIFE_LIFE_STUDY":    { emoji: "🌻", name: "太陽の子" },
  "LIFE_LIFE_STAMINA":  { emoji: "🌊", name: "海の精霊" },
  "LIFE_LIFE_LIFE":     { emoji: "🌍", name: "大地母神" },
};

// ─── getMonsterStage ──────────────────────────────────
// evolutionStage=0 → 卵、1+ → MONSTER_TABLE[evolutionPath]
export function getMonsterStage(evolutionStage: number, evolutionPath: string) {
  if (evolutionStage <= 0) return EGG_STAGE;

  const stageIdx = Math.min(evolutionStage, EVOLUTION_THRESHOLDS.length - 1);
  const ptToEvolve = EVOLUTION_THRESHOLDS[stageIdx];
  const monster = MONSTER_TABLE[evolutionPath] ?? { emoji: "❓", name: "???" };

  return { ...monster, ptToEvolve };
}

// ─── computeEvolutionWeights ──────────────────────────
// dominant パラメータは最大60%の確率、残り40%は2番目・3番目の比率で分配
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

  return weights;
}

// ─── selectEvolutionPath ─────────────────────────────
// 加重乱数でパスを選択する
export function selectEvolutionPath(
  studyPt: number,
  staminaPt: number,
  lifePt: number,
): MonsterPath {
  const weights = computeEvolutionWeights(studyPt, staminaPt, lifePt);
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
// ステージ0→1（孵化）はパス選択なし（newPath = ""）
// ステージ1以降の進化でパスを加重乱数で選択し追記する。
export function checkEvolution(
  evolutionStage: number,
  evolutionPath: string,
  studyPt: number,
  staminaPt: number,
  lifePt: number,
): {
  evolved: boolean;
  newStage: number;
  newPath: string;
  resetStudy: number;
  resetStamina: number;
  resetLife: number;
} {
  const stageIdx = Math.min(evolutionStage, EVOLUTION_THRESHOLDS.length - 1);
  const threshold = EVOLUTION_THRESHOLDS[stageIdx];
  const total = studyPt + staminaPt + lifePt;

  if (threshold === null || total < threshold) {
    return {
      evolved: false,
      newStage: evolutionStage,
      newPath: evolutionPath,
      resetStudy: studyPt,
      resetStamina: staminaPt,
      resetLife: lifePt,
    };
  }

  // 孵化（stage 0→1）はパス選択しない
  let newPath: string;
  if (evolutionStage === 0) {
    newPath = "";
  } else {
    const selected = selectEvolutionPath(studyPt, staminaPt, lifePt);
    newPath = evolutionPath ? `${evolutionPath}_${selected}` : selected;
  }

  return {
    evolved: true,
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
) {
  const total = studyPt + staminaPt + lifePt;
  const stageIdx = Math.min(evolutionStage, EVOLUTION_THRESHOLDS.length - 1);
  const xpToEvolve = EVOLUTION_THRESHOLDS[stageIdx];

  return {
    totalPt: total,
    evolutionStage: stageIdx,
    xpInStage: total,
    xpToEvolve,
    ptNeeded: xpToEvolve !== null ? xpToEvolve - total : null,
    evolutionWeights:
      xpToEvolve !== null ? computeEvolutionWeights(studyPt, staminaPt, lifePt) : null,
  };
}

// Day of week labels (Japanese)
export const DAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"] as const;

// Generate 6-char family code
export function generateFamilyCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Exclude confusing chars
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// ─── ストリーク ──────────────────────────────────────
export const STREAK_MILESTONES = [
  { days: 3, title: "はじめの一歩", emoji: "🔥", bonusPt: 5 },
  { days: 7, title: "一週間の戦士", emoji: "⚔️", bonusPt: 10 },
  { days: 30, title: "月の修行者", emoji: "🌙", bonusPt: 20 },
  { days: 100, title: "伝説の冒険者", emoji: "👑", bonusPt: 30 },
] as const;

/** 現在のストリークに対応する称号（未達成なら null） */
export function getStreakTitle(currentStreak: number) {
  let best: (typeof STREAK_MILESTONES)[number] | null = null;
  for (const m of STREAK_MILESTONES) {
    if (currentStreak >= m.days) best = m;
  }
  return best;
}

/** oldStreak→newStreak で新たに到達したマイルストーンのボーナス合計を返す */
export function getNewMilestoneBonus(oldStreak: number, newStreak: number): number {
  let bonus = 0;
  for (const m of STREAK_MILESTONES) {
    if (oldStreak < m.days && newStreak >= m.days) bonus += m.bonusPt;
  }
  return bonus;
}

/** ボーナスptを3カテゴリ均等分配（端数は STUDY に加算） */
export function distributeBonus(bonus: number): { study: number; stamina: number; life: number } {
  const base = Math.floor(bonus / 3);
  const remainder = bonus - base * 3;
  return { study: base + remainder, stamina: base, life: base };
}

// Rejection reason presets by category
export const REJECTION_REASONS: Record<Category, string[]> = {
  STUDY: [
    "宿題のページが違うよ",
    "まだ全部終わってないみたい",
    "字が読めないよ、書き直してね",
    "写真が暗くてよく見えないよ",
    "その他",
  ],
  STAMINA: [
    "時間が短すぎるよ、もう少しやってみよう",
    "まだ全部終わってないみたい",
    "写真や動画をつけてね",
    "別のことをやってたみたい",
    "その他",
  ],
  LIFE: [
    "まだ全部終わってないみたい",
    "きれいになってないところがあるよ",
    "写真が暗くてよく見えないよ",
    "もう少し丁寧にやってみよう",
    "その他",
  ],
};

// Generate 4-digit child code (ユーザーコード)
export function generateChildCode(): string {
  const digits = "0123456789";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += digits[Math.floor(Math.random() * digits.length)];
  }
  return code;
}
