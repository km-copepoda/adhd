import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { recordLoginActivity } from "@/lib/loginStreak";
import { todayJST } from "@/lib/date";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }
  if (user.role !== "CHILD") {
    return NextResponse.json({ error: "子供のみ利用できます" }, { status: 403 });
  }

  const result = await recordLoginActivity(user.id, todayJST());

  return NextResponse.json(result);
}
