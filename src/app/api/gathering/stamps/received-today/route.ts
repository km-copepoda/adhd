import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { todayJST } from "@/lib/date";

/**
 * 自分の所属グループで今日届いたエール（自分送信は除外）を一覧返却。
 * クライアントは localStorage の seenIds と突合して未読分のみトーストする。
 * 4日経過した古い Stamp は対象外（@db.Date の today 一致のみ）。
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "CHILD") {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const member = await prisma.gatheringMember.findUnique({
    where: { childId: user.id },
    select: { groupId: true },
  });
  if (!member) {
    return NextResponse.json({ stamps: [] });
  }

  const stamps = await prisma.stamp.findMany({
    where: {
      groupId: member.groupId,
      senderId: { not: user.id },
      date: todayJST(),
    },
    select: {
      id: true,
      senderId: true,
      sender: { select: { monsterName: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    stamps: stamps.map((s) => ({
      id: s.id,
      senderId: s.senderId,
      senderName: s.sender.monsterName ?? s.sender.name ?? "なかま",
    })),
  });
}
