import { resolvePlan, type SubscriptionPlan } from "@/lib/subscription";

export const ACCOUNT_DELETE_CONFIRM_TEXT = "削除します";

/** アカウント削除後に外部サービス（Supabase Auth / Storage）から消す対象 */
export interface ExternalCleanup {
  supabaseIds: string[];
  childIds: string[];
  photoPaths: string[];
  familyId?: string | null;
}

export function isDeleteConfirmed(input: unknown): boolean {
  return typeof input === "string" && input.trim() === ACCOUNT_DELETE_CONFIRM_TEXT;
}

/**
 * 有効な有料プランが未解約のままなら削除をブロックする（ストア課金は本人にしか止められない）。
 * ストアで解約済み（canceledAt あり）なら期間内でも削除を許可する。
 */
export function hasBlockingSubscription(
  sub: { plan: SubscriptionPlan; currentPeriodEnd: Date | null; canceledAt: Date | null } | null,
  now: Date,
): boolean {
  if (!sub) return false;
  return resolvePlan(sub, now) === "PREMIUM" && sub.canceledAt == null;
}
