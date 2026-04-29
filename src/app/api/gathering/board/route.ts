import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { todayJST } from "@/lib/date";

const LOG_RETENTION_DAYS = 4;

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  // 子供: 自分のグループ / 親: childId 指定の子供のグループ
  let childId = user.id;
  if (user.role === "PARENT") {
    const { searchParams } = new URL(request.url);
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

  // 直近 LOG_RETENTION_DAYS 日分（今日, -1, -2, -3）を BulletinLog.date でフィルタ
  const today = todayJST();
  const oldest = new Date(today.getTime() - (LOG_RETENTION_DAYS - 1) * 86400000);

  const logs = await prisma.bulletinLog.findMany({
    where: { groupId: member.groupId, date: { gte: oldest } },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 200,
  });

  return NextResponse.json(logs);
}
