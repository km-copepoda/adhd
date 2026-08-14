import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { grantPremiumForE2E } from "@/lib/subscriptionService";
import { routeLogger } from "@/lib/logger";

/**
 * e2eテスト専用: 自分の家族のPARENTユーザーにPREMIUMプランを無期限で付与する。
 *
 * 本番環境で誤って有効化されると課金回避の穴になるため、二重にガードする。
 * 1. ALLOW_E2E_SETUP !== "1" の場合は 404 を返し、エンドポイントの存在自体を隠す
 * 2. x-e2e-setup-secret ヘッダーが E2E_SETUP_SECRET と一致しない場合は 401
 */
export async function POST(request: NextRequest) {
  const rlog = routeLogger("POST", "/api/dev/subscription");

  if (process.env.ALLOW_E2E_SETUP !== "1") {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  const expectedSecret = process.env.E2E_SETUP_SECRET;
  const providedSecret = request.headers.get("x-e2e-setup-secret");
  if (!expectedSecret || providedSecret !== expectedSecret) {
    rlog.warn("Invalid or missing e2e setup secret");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }
  if (!user.familyId) {
    return NextResponse.json({ error: "familyIdが必要です" }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}) as Record<string, unknown>);
  if (
    typeof body === "object" &&
    body !== null &&
    "familyId" in body &&
    body.familyId !== undefined &&
    body.familyId !== user.familyId
  ) {
    rlog.warn("Attempted to grant premium for a different family", {
      familyId: user.familyId,
    });
    return NextResponse.json({ error: "他の家族のプランは変更できません" }, { status: 403 });
  }

  const sub = await grantPremiumForE2E(user.familyId);
  if (!sub) {
    rlog.error("PARENT user not found for family", { familyId: user.familyId });
    return NextResponse.json({ error: "家族にPARENTユーザーが見つかりません" }, { status: 500 });
  }

  rlog.done("E2E premium plan granted", { familyId: user.familyId });
  return NextResponse.json({ ok: true, plan: "PREMIUM", currentPeriodEnd: null });
}
