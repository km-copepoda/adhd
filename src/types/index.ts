// Shared types for client components (no Prisma dependency)

export type Role = "PARENT" | "CHILD";
export type Side = "DARK" | "LIGHT";
export type Category = "STUDY" | "STAMINA" | "LIFE";
export type MonsterPath = "STUDY" | "STAMINA" | "LIFE";
export type QuestStatus = "PENDING" | "REPORTED" | "APPROVED" | "REJECTED" | "SKIPPED" | "SKIP_REPORTED";
