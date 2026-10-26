import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { checkE2eSetupGuard } from "@/lib/e2eSetupGuard";
import { grantPremiumForE2E, cancelE2ePremium } from "@/lib/subscriptionService";
import { routeLogger } from "@/lib/logger";

type Rlog = ReturnType<typeof routeLogger>;

/// POST/DELETE 共通: ガード → PARENT 本人の確認 → familyId 検証。
/// 通過すれば本人の userId を、弾く場合はレスポンスを返す。
async function authorize(
  request: NextRequest,
  rlog: Rlog,
): Promise<{ userId: string } | { response: NextResponse }> {
  const guard = checkE2eSetupGuard(request);
  if (guard) {
    if (guard.status === 401) rlog.warn("Invalid or missing e2e setup secret");
    return { response: guard };
  }

  const user = await getCurrentUser();
  if (!user || user.role !== "PARENT") {
    return { response: NextResponse.json({ error: "権限がありません" }, { status: 403 }) };
  }
  if (!user.familyId) {
    return { response: NextResponse.json({ error: "familyIdが必要です" }, { status: 400 }) };
  }

  const body = await request.json().catch(() => ({}) as Record<string, unknown>);
  if (
    typeof body === "object" &&
    body !== null &&
    "familyId" in body &&
    body.familyId !== undefined &&
    body.familyId !== user.familyId
  ) {
    rlog.warn("Attempted to change plan for a different family", { familyId: user.familyId });
    return {
      response: NextResponse.json({ error: "他の家族のプランは変更できません" }, { status: 403 }),
    };
  }

  return { userId: user.id };
}

/**
 * e2eテスト専用: 認証した PARENT 本人に PREMIUM プランを無期限で付与する。
 * 付与した行には platform="E2E" の印を付ける。印のない既存行は書き換えず 409。
 *
 * 本番環境で誤って有効化されると課金回避の穴になるため、二重にガードする (@/lib/e2eSetupGuard)。
 */
export async function POST(request: NextRequest) {
  const rlog = routeLogger("POST", "/api/dev/subscription");
  const auth = await authorize(request, rlog);
  if ("response" in auth) return auth.response;

  const result = await grantPremiumForE2E(auth.userId);
  if (result.status === "not_eligible") {
    rlog.warn("Existing non-E2E subscription row; refusing to overwrite");
    return NextResponse.json(
      { error: "E2E以外のサブスクリプションがあるため付与できません" },
      { status: 409 },
    );
  }

  rlog.done("E2E premium plan granted");
  return NextResponse.json({ ok: true, plan: "PREMIUM", currentPeriodEnd: null });
}

/**
 * e2eテスト専用: POST で付与した E2E の PREMIUM を解約済みにする (DELETE /api/account の課金ガードを通すため)。
 * 対象は認証した PARENT 本人の platform="E2E" の行だけ。
 */
export async function DELETE(request: NextRequest) {
  const rlog = routeLogger("DELETE", "/api/dev/subscription");
  const auth = await authorize(request, rlog);
  if ("response" in auth) return auth.response;

  const result = await cancelE2ePremium(auth.userId, new Date());
  if (result.status === "not_found") {
    return NextResponse.json({ error: "サブスクリプションが見つかりません" }, { status: 404 });
  }
  if (result.status === "not_eligible") {
    rlog.warn("Subscription is not an E2E-granted row; refusing to cancel");
    return NextResponse.json(
      { error: "E2Eで付与したサブスクリプションではないため解約できません" },
      { status: 409 },
    );
  }

  rlog.done("E2E premium plan canceled", { status: result.status });
  return NextResponse.json({ ok: true, status: result.status });
}
