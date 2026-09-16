// 子用 — 自分自身のタスク上限・現在件数のみを返す (preempt チェック用)。
// GET /api/subscription/child-task-limit — CHILD のみ
//
// 子供にプラン名・課金文言を見せない (monetization-plan.md §5.1) ため、
// `{ limit, current }` のみを返し、plan / currentPeriodEnd 等は含めない。
// クエリパラメータで childId を渡されても無視し、常に認証済みユーザー自身の件数のみ返す。

import { NextResponse } from "next/server";
import { requireUser, AuthError } from "@/lib/auth";
import { computeLimit } from "@/lib/subscription";
import { countActiveTasksForChild, getFamilyPlan } from "@/lib/subscriptionService";

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Next.js Route Handler の規約上 request 引数を受け取る
export async function GET(_request: Request) {
  try {
    const user = await requireUser("CHILD");

    if (!user.familyId) {
      // 単独モード (familyId=null) は課金概念外。FREE固定・current:0 を返し count は呼ばない。
      return NextResponse.json({ limit: computeLimit("FREE", "task"), current: 0 });
    }

    const plan = await getFamilyPlan(user.familyId);
    const current = await countActiveTasksForChild(user.id);
    return NextResponse.json({ limit: computeLimit(plan, "task"), current });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "上限情報の取得に失敗しました" }, { status: 500 });
  }
}
