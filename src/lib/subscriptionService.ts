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

/// Family 内の課金主体 (PARENT) の id を返す。見つからなければ null。
/// `getFamilyPlan` / `/api/subscription/status` の両方で同じ規則 (findFirst) を使うための共通処理。
async function findFamilyBillingParentId(familyId: string): Promise<string | null> {
  const parent = await prisma.user.findFirst({
    where: { familyId, role: "PARENT" },
    select: { id: true },
  });
  return parent?.id ?? null;
}

/// Family の実効プランを返す。課金主体は Family 内の PARENT。
/// PARENT が見つからない (壊れたデータ) は安全側で FREE にフォールバック。
export async function getFamilyPlan(
  familyId: string,
  now: Date = new Date(),
): Promise<SubscriptionPlan> {
  const parentId = await findFamilyBillingParentId(familyId);
  if (!parentId) return "FREE";
  return getUserPlan(parentId, now);
}

/// Family の課金主体 (PARENT) の Subscription レコードをそのまま返す (実効プラン判定前の生データ)。
/// `/api/subscription/status` が「実効プランと currentPeriodEnd の整合」を自前で計算するために使う。
export async function getFamilySubscription(familyId: string) {
  const parentId = await findFamilyBillingParentId(familyId);
  if (!parentId) return null;
  return getSubscription(parentId);
}

/// FREE プラン上限判定用の「有効な (幽霊でない) タスク」を絞り込む where 条件フラグメント
/// (`assignedChildId` は含まない)。単体 count (`countActiveTasksForChild`) と family 全体の
/// groupBy 集計 (`getFamilyUsage`) の両方で使い回し、条件の書き手ドリフトを防ぐ。
///
/// 「有効」の定義:
///   isActive AND pausedAt IS NULL AND NOT (isTemporary AND targetDate < today)
///
/// targetDate 経過済みの一時タスクは親画面 (isVisibleTemporaryTask) から除外され
/// 「幽霊タスク」となる。幽霊を上限に含めると、月日が経つにつれ FREE ユーザーが
/// 実質的に新タスクを作れなくなるため、表示に整合した数でカウントする。
function activeTaskWhereFragment(today: Date) {
  return {
    isActive: true,
    pausedAt: null,
    NOT: {
      isTemporary: true,
      targetDate: { lt: today },
    },
  } as const;
}

export async function countActiveTasksForChild(
  assignedChildId: string,
  today: Date = todayJST(),
): Promise<number> {
  return prisma.taskTemplate.count({
    where: {
      assignedChildId,
      ...activeTaskWhereFragment(today),
    },
  });
}

export interface FamilyUsagePerChild {
  childId: string;
  displayName: string;
  taskCount: number;
  treasureItemCount: number;
}

export interface FamilyUsage {
  child: number;
  perChild: FamilyUsagePerChild[];
}

/// Family 内の子アカウント一覧・タスク数・ごほうび数を集計する (プラン管理ページ用)。
/// 子ごとに count() を個別に呼ぶと N+1 になるため、固定3クエリ (子一覧 / タスク groupBy /
/// ごほうび groupBy) で完結させる (Issue #148 v2差分3番)。
export async function getFamilyUsage(
  familyId: string,
  today: Date = todayJST(),
): Promise<FamilyUsage> {
  const children = await prisma.user.findMany({
    where: { familyId, role: "CHILD" },
    select: { id: true, name: true, monsterName: true },
  });
  if (children.length === 0) {
    return { child: 0, perChild: [] };
  }
  const childIds = children.map((c) => c.id);

  const [taskGroups, treasureGroups] = await Promise.all([
    prisma.taskTemplate.groupBy({
      by: ["assignedChildId"],
      where: {
        familyId,
        assignedChildId: { in: childIds },
        ...activeTaskWhereFragment(today),
      },
      _count: { _all: true },
    }),
    prisma.treasureItem.groupBy({
      by: ["childId"],
      where: { childId: { in: childIds }, isActive: true },
      _count: { _all: true },
    }),
  ]);

  const taskCountByChild = new Map(
    taskGroups
      .filter((g) => g.assignedChildId !== null)
      .map((g) => [g.assignedChildId as string, g._count._all]),
  );
  const treasureCountByChild = new Map(treasureGroups.map((g) => [g.childId, g._count._all]));

  const perChild = children.map((c) => ({
    childId: c.id,
    displayName: c.monsterName ?? c.name ?? "子供",
    taskCount: taskCountByChild.get(c.id) ?? 0,
    treasureItemCount: treasureCountByChild.get(c.id) ?? 0,
  }));

  return { child: children.length, perChild };
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
