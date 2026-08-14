/// Subscription テーブルへの DB アクセス。純粋関数は @/lib/subscription を参照。
/// 仕様: docs/未実装仕様書/monetization-plan.md

import { prisma } from "@/lib/prisma";
import { resolvePlan, type SubscriptionPlan } from "@/lib/subscription";
import { todayJST } from "@/lib/date";

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

/// FREE プラン上限判定用の「有効な (幽霊でない) タスク数」を返す。
///
/// 「有効」の定義:
///   isActive AND pausedAt IS NULL AND NOT (isTemporary AND targetDate < today)
///
/// targetDate 経過済みの一時タスクは親画面 (isVisibleTemporaryTask) から除外され
/// 「幽霊タスク」となる。幽霊を上限に含めると、月日が経つにつれ FREE ユーザーが
/// 実質的に新タスクを作れなくなるため、表示に整合した数でカウントする。
export async function countActiveTasksForChild(
  assignedChildId: string,
  today: Date = todayJST(),
): Promise<number> {
  return prisma.taskTemplate.count({
    where: {
      assignedChildId,
      isActive: true,
      pausedAt: null,
      NOT: {
        isTemporary: true,
        targetDate: { lt: today },
      },
    },
  });
}

/// e2eテストセットアップ専用。Family内のPARENTユーザーにPREMIUMプランを無期限で付与する。
/// `Subscription.userId` が @unique のため、Family単位ではなくPARENTユーザー単位でupsertする。
/// PARENTが見つからない場合は呼び出し側で500として扱えるよう null を返す。
export async function grantPremiumForE2E(familyId: string) {
  const parent = await prisma.user.findFirst({
    where: { familyId, role: "PARENT" },
    select: { id: true },
  });
  if (!parent) return null;

  const sub = await prisma.subscription.upsert({
    where: { userId: parent.id },
    update: { plan: "PREMIUM", currentPeriodEnd: null },
    create: { userId: parent.id, plan: "PREMIUM", currentPeriodEnd: null },
  });
  return sub;
}
