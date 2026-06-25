import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { recordCheckin } from "@/lib/checkin";
import { routeLogger } from "@/lib/logger";

export async function POST() {
  const rlog = routeLogger("POST", "/api/checkin/today");
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }
  if (user.role !== "CHILD") {
    return NextResponse.json({ error: "子供のみ利用できます" }, { status: 403 });
  }

  const result = await recordCheckin(user.id, new Date());

  if (result.justNow) {
    rlog.info("Checkin succeeded", { userId: user.id, streak: result.currentStreak });
  }

  return NextResponse.json(result);
}
