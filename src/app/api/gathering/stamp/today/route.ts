import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { todayJST } from "@/lib/date";

/** 今日エールを送信済みかどうか（UI ボタンの disabled 制御用）。 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "CHILD") {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const stamp = await prisma.stamp.findUnique({
    where: { senderId_date: { senderId: user.id, date: todayJST() } },
    select: { id: true },
  });

  return NextResponse.json({ sentToday: !!stamp });
}
