// 親用 — 上限値のみを返す軽量版 (親タスク画面等の preempt チェック用)。
// GET /api/subscription/limits — PARENT のみ
//
// /api/subscription/status は「子人数×2件の groupBy クエリ」を撃つため、usage が
// 不要な画面がこちらを叩くと無駄な初期ロードの遅延を避けられる。

import { NextResponse } from "next/server";
import { requireUser, AuthError } from "@/lib/auth";
import { LIMITS } from "@/lib/subscription";
import { getFamilyPlan } from "@/lib/subscriptionService";

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Next.js Route Handler の規約上 request 引数を受け取る
export async function GET(_request: Request) {
  try {
    const user = await requireUser("PARENT");
    // 単独モード (familyId=null) は課金概念外。FREE固定。
    const plan = user.familyId ? await getFamilyPlan(user.familyId) : "FREE";
    // グローバルな LIMITS を破壊しないよう、呼び出し元が書き換えても影響しない新規オブジェクトを返す。
    return NextResponse.json({ ...LIMITS[plan] });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "プラン上限の取得に失敗しました" }, { status: 500 });
  }
}
