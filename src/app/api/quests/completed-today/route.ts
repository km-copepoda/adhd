import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { todayRangeJST } from "@/lib/date";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "PARENT" || !user.familyId) {
    return NextResponse.json([]);
  }

  const { start, end } = todayRangeJST();

  const quests = await prisma.questInstance.findMany({
    where: {
      status: { in: ["APPROVED", "SKIPPED"] },
      reportedAt: {
        gte: start,
        lt: end,
      },
      template: { familyId: user.familyId },
    },
    include: {
      child: {
        select: { name: true, monsterName: true, side: true },
      },
      template: {
        select: { title: true, emoji: true, category: true, isTemporary: true },
      },
    },
    orderBy: { reportedAt: "desc" },
  });

  return NextResponse.json(quests);
}
