import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { recordLoginActivity } from "@/lib/loginStreak";
import { checkAndUnlockBadges } from "@/lib/badges";
import { todayJST } from "@/lib/date";
import { routeLogger } from "@/lib/logger";

export async function POST() {
  const rlog = routeLogger("POST", "/api/streak/login-check");
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }
  if (user.role !== "CHILD") {
    return NextResponse.json({ error: "子供のみ利用できます" }, { status: 403 });
  }

  const result = await recordLoginActivity(user.id, todayJST());

  if (result.bonusGranted > 0) {
    rlog.info("Login streak bonus granted", { userId: user.id, streak: result.loginStreak, bonus: result.bonusGranted });
  }

  // バッジ解除チェック（ログイン系バッジを確認）
  checkAndUnlockBadges(user.id).catch(() => {});

  return NextResponse.json(result);
}
