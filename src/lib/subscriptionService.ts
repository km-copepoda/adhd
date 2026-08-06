/// Subscription テーブルへの DB アクセス。純粋関数は @/lib/subscription を参照。
/// 仕様: docs/未実装仕様書/monetization-plan.md

import { prisma } from "@/lib/prisma";
import { resolvePlan, type SubscriptionPlan } from "@/lib/subscription";

export async function getSubscription(userId: string) {
  return prisma.subscription.findUnique({ where: { userId } });
}

/// ユーザーの実効プランを返す。レコード無し or 期限切れ PREMIUM は FREE。
export async function getUserPlan(userId: string, now: Date = new Date()): Promise<SubscriptionPlan> {
  const sub = await getSubscription(userId);
  return resolvePlan(sub, now);
}

/// Family の実効プランを返す。課金主体は Family 内の PARENT。
/// PARENT が見つからない (壊れたデータ) は安全側で FREE にフォールバック。
export async function getFamilyPlan(
  familyId: string,
  now: Date = new Date(),
): Promise<SubscriptionPlan> {
  const parent = await prisma.user.findFirst({
    where: { familyId, role: "PARENT" },
    select: { id: true },
  });
  if (!parent) return "FREE";
  return getUserPlan(parent.id, now);
}
