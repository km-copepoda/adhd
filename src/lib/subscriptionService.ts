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
