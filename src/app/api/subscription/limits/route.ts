import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getSubscription } from "@/lib/subscriptionService";
import { LIMITS, resolvePlan } from "@/lib/subscription";

/// GET /api/subscription/limits (PARENT 専用)
/// preempt チェック用の軽量エンドポイント。プランに基づく上限値のみ返す。
/// N+1 (家族の子人数 × 2 count クエリ) を避けるため、usage を必要としない画面
/// (親タスク画面等) はこちらを使う。プラン画面は /status を使う。
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }
  if (user.role !== "PARENT") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  // 単独モード (familyId=null) は課金・上限の概念外 → FREE 固定
  if (!user.familyId) {
    return NextResponse.json(LIMITS.FREE);
  }

  const sub = await getSubscription(user.id);
  const plan = resolvePlan(sub, new Date());
  return NextResponse.json(LIMITS[plan]);
}
