import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getSubscription } from "@/lib/subscriptionService";
import { LIMITS, resolvePlan } from "@/lib/subscription";

/// GET /api/subscription/status
/// 親のプランと Family の使用状況 (子ごとの task / treasure_item 数) を返す。
/// UI: /app/parent/plan からの表示 + アップグレード誘導の判断材料。
/// 仕様: docs/未実装仕様書/monetization-plan.md §4.2 / §5.2
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }
  if (user.role !== "PARENT") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const now = new Date();
  const sub = await getSubscription(user.id);

  // 単独モード (familyId=null) は課金・上限の概念外。Subscription が PREMIUM でも
  // FREE + FREE 上限で返す (Phase 1-3 の判断と一貫。仕様書 §2.1)。
  if (!user.familyId) {
    return NextResponse.json({
      plan: "FREE",
      currentPeriodEnd: null,
      limits: LIMITS.FREE,
      usage: { child: 0, perChild: [] },
    });
  }

  const plan = resolvePlan(sub, now);
  const limits = LIMITS[plan];

  const children: { id: string; name: string | null; monsterName: string | null }[] =
    await prisma.user.findMany({
      where: { familyId: user.familyId, role: "CHILD" },
      select: { id: true, name: true, monsterName: true },
      orderBy: { createdAt: "asc" },
    });

  const perChild = await Promise.all(
    children.map(async (c) => {
      const [taskCount, treasureItemCount] = await Promise.all([
        prisma.taskTemplate.count({
          where: { assignedChildId: c.id, isActive: true, pausedAt: null },
        }),
        prisma.treasureItem.count({
          where: { childId: c.id, isActive: true },
        }),
      ]);
      return {
        childId: c.id,
        name: c.monsterName ?? c.name ?? "",
        taskCount,
        treasureItemCount,
      };
    }),
  );

  return NextResponse.json({
    plan,
    currentPeriodEnd: sub?.currentPeriodEnd ?? null,
    limits,
    usage: { child: children.length, perChild },
  });
}
