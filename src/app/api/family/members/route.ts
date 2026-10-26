import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { routeLogger } from "@/lib/logger";
import { getFamilyPlan } from "@/lib/subscriptionService";
import { checkLimit } from "@/lib/subscription";
import { themeIdFromSide } from "@/lib/monsters";
import { MONSTER_THEMES } from "@/lib/monsterThemes/index";

export async function POST(request: Request) {
  const rlog = routeLogger("POST", "/api/family/members");
  const user = await getCurrentUser();
  if (!user || user.role !== "PARENT" || !user.familyId) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const { monsterName, side, themeId } = await request.json();
  if (!monsterName || !side) {
    return NextResponse.json({ error: "名前とサイドを入力してください" }, { status: 400 });
  }

  // themeId は任意。未指定（null/undefined）なら side から決まる無料テーマを使う
  let monsterSetId = themeIdFromSide(side);
  if (themeId !== undefined && themeId !== null) {
    if (typeof themeId !== "string" || !MONSTER_THEMES[themeId]) {
      return NextResponse.json({ error: "無効なテーマです" }, { status: 400 });
    }
    if (MONSTER_THEMES[themeId].isFree === false) {
      // 所持判定は monster-theme PATCH と同じく家族単位（FamilyMonsterTheme）
      const owned = await prisma.familyMonsterTheme.findUnique({
        where: { familyId_themeId: { familyId: user.familyId, themeId } },
      });
      if (!owned) {
        return NextResponse.json({ error: "このテーマはまだ購入されていません" }, { status: 400 });
      }
    }
    monsterSetId = themeId;
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

  // Create child user with a placeholder supabaseId (will be updated on first login)
  const child = await prisma.user.create({
    data: {
      supabaseId: `pending_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      role: "CHILD",
      monsterName,
      side,
      monsterSetId,
      familyId: user.familyId,
    },
  });

  rlog.info("Child member created", { childId: child.id, familyId: user.familyId });
  return NextResponse.json({
    id: child.id,
    monsterName: child.monsterName,
    side: child.side,
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
