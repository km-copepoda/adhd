// 親用 — プラン管理ページ (/app/parent/plan) の表示に使う「現在のプラン + 利用状況」。
// GET /api/subscription/status — PARENT のみ

import { NextResponse } from "next/server";
import { requireUser, AuthError } from "@/lib/auth";
import { computeLimit, isPlanActive } from "@/lib/subscription";
import { getFamilySubscription, getFamilyUsage } from "@/lib/subscriptionService";

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Next.js Route Handler の規約上 request 引数を受け取る
export async function GET(_request: Request) {
  try {
    const user = await requireUser("PARENT");

    if (!user.familyId) {
      // 単独モード (familyId=null) は課金概念外。FREE固定・子一覧クエリを撃たない。
      return NextResponse.json({
        plan: "FREE",
        currentPeriodEnd: null,
        limits: {
          child: computeLimit("FREE", "child"),
          task: computeLimit("FREE", "task"),
          treasure_item: computeLimit("FREE", "treasure_item"),
        },
        usage: { child: 0, perChild: [] },
      });
    }

    const now = new Date();
    const sub = await getFamilySubscription(user.familyId);
    const active = isPlanActive(sub, now);
    const plan = active ? "PREMIUM" : "FREE";
    // 実効プランと currentPeriodEnd を整合させる。実効 FREE (レコード無し or 期限切れ) は
    // 生の期限をそのまま出さず null にする (Issue #148 v2差分9番)。
    const currentPeriodEnd = active ? (sub?.currentPeriodEnd ?? null) : null;

    const usage = await getFamilyUsage(user.familyId);

    return NextResponse.json({
      plan,
      currentPeriodEnd,
      limits: {
        child: computeLimit(plan, "child"),
        task: computeLimit(plan, "task"),
        treasure_item: computeLimit(plan, "treasure_item"),
      },
      usage,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "プラン情報の取得に失敗しました" }, { status: 500 });
  }
}
