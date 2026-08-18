import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { generateChildCode } from "@/lib/categories";
import { routeLogger } from "@/lib/logger";
import { getFamilyPlan } from "@/lib/subscriptionService";
import { checkLimit } from "@/lib/subscription";
import { themeIdFromSide } from "@/lib/monsters";

export async function POST(request: Request) {
  const rlog = routeLogger("POST", "/api/family/members");
  const user = await getCurrentUser();
  if (!user || user.role !== "PARENT" || !user.familyId) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const { monsterName, side } = await request.json();
  if (!monsterName || !side) {
    return NextResponse.json({ error: "名前とサイドを入力してください" }, { status: 400 });
  }

  // FREE プランの子アカウント上限 enforce (仕様: monetization-plan.md §2.1 / §4.4)
  const plan = await getFamilyPlan(user.familyId);
  const childCount = await prisma.user.count({
    where: { familyId: user.familyId, role: "CHILD" },
  });
  const limitCheck = checkLimit(plan, "child", childCount);
  if (!limitCheck.allowed) {
    rlog.warn("Child add blocked by plan limit", { familyId: user.familyId, childCount });
    return NextResponse.json(
      {
        error: `無料プランでは子アカウントは${limitCheck.limit}人までです。プレミアムプランで無制限になります。`,
        code: "PLAN_LIMIT_EXCEEDED",
        resource: "child",
        current: limitCheck.current,
        limit: limitCheck.limit,
      },
      { status: 403 },
    );
  }

  // Generate unique child code within the family
  let childCode: string | null = null;
  for (let i = 0; i < 10; i++) {
    const candidate = generateChildCode();
    const existing = await prisma.user.findUnique({
      where: { familyId_childCode: { familyId: user.familyId, childCode: candidate } },
    });
    if (!existing) {
      childCode = candidate;
      break;
    }
  }
  if (!childCode) {
    return NextResponse.json({ error: "コード生成に失敗しました。再度お試しください" }, { status: 500 });
  }

  // Create child user with a placeholder supabaseId (will be updated on first login)
  const child = await prisma.user.create({
    data: {
      supabaseId: `pending_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      role: "CHILD",
      monsterName,
      side,
      monsterSetId: themeIdFromSide(side),
      familyId: user.familyId,
      childCode,
    },
  });

  rlog.info("Child member created", { childId: child.id, familyId: user.familyId });
  return NextResponse.json({
    id: child.id,
    monsterName: child.monsterName,
    side: child.side,
    childCode: child.childCode,
  });
}

export async function PATCH(request: Request) {
  const rlog = routeLogger("PATCH", "/api/family/members");
  const user = await getCurrentUser();
  if (!user || user.role !== "PARENT" || !user.familyId) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const { childId, minTasksForStreak } = await request.json();
  if (!childId || typeof minTasksForStreak !== "number" || minTasksForStreak < 1) {
    return NextResponse.json({ error: "childIdと1以上のminTasksForStreakが必要です" }, { status: 400 });
  }

  // 同じファミリーの子供か確認
  const child = await prisma.user.findFirst({
    where: { id: childId, familyId: user.familyId, role: "CHILD" },
  });
  if (!child) {
    return NextResponse.json({ error: "子供が見つかりません" }, { status: 404 });
  }

  await prisma.user.update({
    where: { id: childId },
    data: { minTasksForStreak },
  });

  rlog.info("Min tasks updated", { childId, minTasksForStreak });
  return NextResponse.json({ ok: true });
}
