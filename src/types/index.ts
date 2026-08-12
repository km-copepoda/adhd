// Shared types for client components (no Prisma dependency)

export type Role = "PARENT" | "CHILD";
export type Side = "DARK" | "LIGHT";
export type Category = "STUDY" | "STAMINA" | "LIFE";
export type MonsterPath = "STUDY" | "STAMINA" | "LIFE";
export type QuestStatus = "PENDING" | "REPORTED" | "APPROVED" | "REJECTED" | "SKIPPED" | "SKIP_REPORTED";

// /api/monster-status および /api/parent/child-view/monster-status のレスポンス形状。
// 両ルートで返却フィールドが同一のため、フック（useMonsterStatus）側と型を共有する。
export type MonsterStatusResponse = {
  name: string;
  side: Side | null;
  evolutionStage: number;
  evolutionPath: string;
  collectedPaths: string;
  studyPt: number;
  staminaPt: number;
  lifePt: number;
  pendingStudyPt: number;
  pendingStaminaPt: number;
  pendingLifePt: number;
  rebirthPending: boolean;
  rebirthEggBonus: string | null;
  currentStreak: number;
  bestStreak: number;
  monthlyDays: number;
  lastAchievedDate: string | null;
  currentTitle: { title: string; emoji: string } | null;
};
