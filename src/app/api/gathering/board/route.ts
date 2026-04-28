import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { todayJST } from "@/lib/date";

const LOG_RETENTION_DAYS = 4;

/** "YYYY-MM-DD" を JST日付の UTC 0:00 Date に変換（todayJST 規約と同じ） */
function parseJstDate(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return isNaN(date.getTime()) ? null : date;
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);

  // 子供: 自分のグループ / 親: childId 指定の子供のグループ
  let childId = user.id;
  if (user.role === "PARENT") {
    const qChildId = searchParams.get("childId");
    if (!qChildId) return NextResponse.json([]);

    const child = await prisma.user.findFirst({
      where: { id: qChildId, familyId: user.familyId ?? undefined, role: "CHILD" },
      select: { id: true },
    });
    if (!child) return NextResponse.json({ error: "子供が見つかりません" }, { status: 404 });
    childId = child.id;
  }

  const member = await prisma.gatheringMember.findUnique({
    where: { childId },
    select: { groupId: true },
  });
  if (!member) return NextResponse.json([]);

  // 対象日: ?date=YYYY-MM-DD（未指定は今日）
  const today = todayJST();
  const requested = searchParams.get("date");
  const targetDate = requested ? parseJstDate(requested) ?? today : today;

  // 直近 LOG_RETENTION_DAYS 日より古い日付は取得不可
  const oldestAllowed = new Date(today.getTime() - (LOG_RETENTION_DAYS - 1) * 86400000);
  if (targetDate.getTime() < oldestAllowed.getTime() || targetDate.getTime() > today.getTime()) {
    return NextResponse.json([]);
  }

  const logs = await prisma.bulletinLog.findMany({
    where: { groupId: member.groupId, date: targetDate },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json(logs);
}
