import type { Difficulty, Category, Side } from "@/types";

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

// Monster evolution stages per side
// ptToEvolve = points needed to evolve FROM this stage to the next (points reset on evolution)
// Stage 0 = egg (hatches with 1pt), 1→2: 10pt, 2→3: 30pt, 3→4: 70pt, 4 = max
export const MONSTER_STAGES: Record<Side, { emoji: string; name: string; ptToEvolve: number | null }[]> = {
  DARK: [
    { emoji: "🥚", name: "やみのたまご", ptToEvolve: 1 },
    { emoji: "👾", name: "シャドウ", ptToEvolve: 10 },
    { emoji: "🧿", name: "スペクター", ptToEvolve: 30 },
    { emoji: "😈", name: "デーモン", ptToEvolve: 70 },
    { emoji: "👑", name: "真・魔王", ptToEvolve: null },
  ],
  LIGHT: [
    { emoji: "🥚", name: "たまご", ptToEvolve: 1 },
    { emoji: "🐣", name: "ヒヨコ", ptToEvolve: 10 },
    { emoji: "🦊", name: "キツネ", ptToEvolve: 30 },
    { emoji: "🦄", name: "ユニコーン", ptToEvolve: 70 },
    { emoji: "🌟", name: "スタースピリット", ptToEvolve: null },
  ],
};

// Get current monster stage by evolutionStage index
export function getMonsterStage(side: Side, evolutionStage: number) {
  const stages = MONSTER_STAGES[side];
  return stages[Math.min(evolutionStage, stages.length - 1)];
}

// Check if evolution should happen after adding points.
// Returns { evolved, newStage, resetStudy, resetStamina, resetLife }
export function checkEvolution(
  side: Side,
  evolutionStage: number,
  studyPt: number,
  staminaPt: number,
  lifePt: number,
): { evolved: boolean; newStage: number; resetStudy: number; resetStamina: number; resetLife: number } {
  const stages = MONSTER_STAGES[side];
  const current = stages[Math.min(evolutionStage, stages.length - 1)];
  const total = studyPt + staminaPt + lifePt;

  if (current.ptToEvolve !== null && total >= current.ptToEvolve) {
    return {
      evolved: true,
      newStage: evolutionStage + 1,
      resetStudy: 0,
      resetStamina: 0,
      resetLife: 0,
    };
  }

  return { evolved: false, newStage: evolutionStage, resetStudy: studyPt, resetStamina: staminaPt, resetLife: lifePt };
}

// Compute XP info for display (progress toward next evolution)
export function getXpInfo(side: Side, evolutionStage: number, studyPt: number, staminaPt: number, lifePt: number) {
  const total = studyPt + staminaPt + lifePt;
  const stages = MONSTER_STAGES[side];
  const stageIdx = Math.min(evolutionStage, stages.length - 1);
  const current = stages[stageIdx];
  const nextStage = stageIdx + 1 < stages.length ? stages[stageIdx + 1] : null;

  return {
    totalPt: total,
    evolutionStage: stageIdx,
    xpInStage: total,
    xpToEvolve: current.ptToEvolve,
    nextEvolution: nextStage && current.ptToEvolve !== null
      ? { ...nextStage, ptNeeded: current.ptToEvolve - total }
      : null,
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
