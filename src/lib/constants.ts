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
// stage0(卵)→1: 1pt  stage1→2: 10pt  stage2→3(最終): 30pt
export const EVOLUTION_THRESHOLDS: (number | null)[] = [1, 10, 30, null];

// ─── たまご ───────────────────────────────────────────
export const EGG_STAGE = { emoji: "🥚", name: "たまご", ptToEvolve: 1 };

// ─── モンスターテーブル ───────────────────────────────
// キー = 進化パス履歴（"STUDY" = stage1、"STUDY_LIFE" = stage2、等）
// ひよこ（共通stage1）は廃止。孵化直後に3系統に分岐する。
// 39体: stage1 x3, stage2 x9, stage3 x27
export const MONSTER_TABLE: Record<string, { image: string; name: string }> = {
  // Stage 1: 3体（孵化直後に分岐）
  "STUDY":   { image: "/monsters/STUDY_ラーン.webp",   name: "ラーン" },
  "STAMINA": { image: "/monsters/STAMINA_ストーン.webp", name: "ストーン" },
  "LIFE":    { image: "/monsters/LIFE_ヘルプ.webp",    name: "ヘルプ" },

  // Stage 2: 9体
  "STUDY_STUDY":     { image: "/monsters/STUDY_STUDY_ライブラ.webp",       name: "ライブラ" },
  "STUDY_STAMINA":   { image: "/monsters/STUDY_STAMINA_アーマード.webp",   name: "アーマード" },
  "STUDY_LIFE":      { image: "/monsters/STUDY_LIFE_クリン.webp",          name: "クリン" },
  "STAMINA_STUDY":   { image: "/monsters/STAMINA_STUDY_グラビド.webp",     name: "グラビド" },
  "STAMINA_STAMINA": { image: "/monsters/STAMINA_STAMINA_ブロック.webp",   name: "ブロック" },
  "STAMINA_LIFE":    { image: "/monsters/STAMINA_LIFE_わっしょい.webp",    name: "わっしょい" },
  "LIFE_STUDY":      { image: "/monsters/LIFE_STUDY_チックタック.webp",    name: "チックタック" },
  "LIFE_STAMINA":    { image: "/monsters/LIFE_STAMINA_キャリア.webp",      name: "キャリア" },
  "LIFE_LIFE":       { image: "/monsters/LIFE_LIFE_マザー.webp",           name: "マザー" },

  // Stage 3: 27体（最終形態）
  "STUDY_STUDY_STUDY":     { image: "/monsters/STUDY_STUDY_STUDY_ウィズダム.webp",           name: "ウィズダム" },
  "STUDY_STUDY_STAMINA":   { image: "/monsters/STUDY_STUDY_STAMINA_タクティクス.webp",       name: "タクティクス" },
  "STUDY_STUDY_LIFE":      { image: "/monsters/STUDY_STUDY_LIFE_エジソン.webp",              name: "エジソン" },
  "STUDY_STAMINA_STUDY":   { image: "/monsters/STUDY_STAMINA_STUDY_フォート.webp",           name: "フォート" },
  "STUDY_STAMINA_STAMINA": { image: "/monsters/STUDY_STAMINA_STAMINA_イージス.webp",         name: "イージス" },
  "STUDY_STAMINA_LIFE":    { image: "/monsters/STUDY_STAMINA_LIFE_レスキュー.webp",          name: "レスキュー" },
  "STUDY_LIFE_STUDY":      { image: "/monsters/STUDY_LIFE_STUDY_マイスター.webp",            name: "マイスター" },
  "STUDY_LIFE_STAMINA":    { image: "/monsters/STUDY_LIFE_STAMINA_スリープ.webp",            name: "スリープ" },
  "STUDY_LIFE_LIFE":       { image: "/monsters/STUDY_LIFE_LIFE_セバス.webp",                 name: "セバス" },
  "STAMINA_STUDY_STUDY":   { image: "/monsters/STAMINA_STUDY_STUDY_クリスタル.webp",         name: "クリスタル" },
  "STAMINA_STUDY_STAMINA": { image: "/monsters/STAMINA_STUDY_STAMINA_マギグラビ.webp",       name: "マギグラビ" },
  "STAMINA_STUDY_LIFE":    { image: "/monsters/STAMINA_STUDY_LIFE_クロック.webp",            name: "クロック" },
  "STAMINA_STAMINA_STUDY": { image: "/monsters/STAMINA_STAMINA_STUDY_ガイア.webp",           name: "ガイア" },
  "STAMINA_STAMINA_STAMINA": { image: "/monsters/STAMINA_STAMINA_STAMINA_ゴッドストーン.webp", name: "ゴッドストーン" },
  "STAMINA_STAMINA_LIFE":  { image: "/monsters/STAMINA_STAMINA_LIFE_ガーディアン.webp",      name: "ガーディアン" },
  "STAMINA_LIFE_STUDY":    { image: "/monsters/STAMINA_LIFE_STUDY_エール.webp",              name: "エール" },
  "STAMINA_LIFE_STAMINA":  { image: "/monsters/STAMINA_LIFE_STAMINA_グロウ.webp",            name: "グロウ" },
  "STAMINA_LIFE_LIFE":     { image: "/monsters/STAMINA_LIFE_LIFE_ミコシ.webp",               name: "ミコシ" },
  "LIFE_STUDY_STUDY":      { image: "/monsters/LIFE_STUDY_STUDY_カレンダー.webp",            name: "カレンダー" },
  "LIFE_STUDY_STAMINA":    { image: "/monsters/LIFE_STUDY_STAMINA_マイスター.webp",          name: "マイスター" },
  "LIFE_STUDY_LIFE":       { image: "/monsters/LIFE_STUDY_LIFE_カロリー.webp",               name: "カロリー" },
  "LIFE_STAMINA_STUDY":    { image: "/monsters/LIFE_STAMINA_STUDY_マーチャント.webp",        name: "マーチャント" },
  "LIFE_STAMINA_STAMINA":  { image: "/monsters/LIFE_STAMINA_STAMINA_ムービング.webp",        name: "ムービング" },
  "LIFE_STAMINA_LIFE":     { image: "/monsters/LIFE_STAMINA_LIFE_ナース.webp",               name: "ナース" },
  "LIFE_LIFE_STUDY":       { image: "/monsters/LIFE_LIFE_STUDY_シェフ.webp",                 name: "シェフ" },
  "LIFE_LIFE_STAMINA":     { image: "/monsters/LIFE_LIFE_STAMINA_サンシャイン.webp",         name: "サンシャイン" },
  "LIFE_LIFE_LIFE":        { image: "/monsters/LIFE_LIFE_LIFE_ゴッドセバス.webp",            name: "ゴッドセバス" },
};

// ─── getMonsterStage ──────────────────────────────────
// evolutionStage=0 → 卵、1+ → MONSTER_TABLE[evolutionPath]
export function getMonsterStage(evolutionStage: number, evolutionPath: string) {
  if (evolutionStage <= 0) return EGG_STAGE;

  const stageIdx = Math.min(evolutionStage, EVOLUTION_THRESHOLDS.length - 1);
  const ptToEvolve = EVOLUTION_THRESHOLDS[stageIdx];
  const monster = MONSTER_TABLE[evolutionPath] ?? { image: "", name: "???" };

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

  // 全ステージでパスを選択（孵化時も含む）
  const selected = selectEvolutionPath(studyPt, staminaPt, lifePt);
  const newPath = evolutionPath ? `${evolutionPath}_${selected}` : selected;

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
