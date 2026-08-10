import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getFamilyPlan } from "@/lib/subscriptionService";
import { LIMITS } from "@/lib/subscription";

/// GET /api/subscription/child-task-limit
/// CHILD 端末で「タスク追加ボタン押下前」に上限判定するための最小情報を返す。
/// プラン名 (FREE/PREMIUM) や金額は返さない — 仕様書 §5.1「子供に課金 UI を見せない」。
/// PARENT は /api/subscription/status を使う。
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }
  if (user.role !== "CHILD") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  // 単独モード CHILD (familyId=null) は Family の親が居ないので FREE 扱い。
  if (!user.familyId) {
    return NextResponse.json({ limit: LIMITS.FREE.task, current: 0 });
  }

  const plan = await getFamilyPlan(user.familyId);
  const limit = LIMITS[plan].task;
  const current = await prisma.taskTemplate.count({
    where: { assignedChildId: user.id, isActive: true, pausedAt: null },
  });

  return NextResponse.json({ limit, current });
}
