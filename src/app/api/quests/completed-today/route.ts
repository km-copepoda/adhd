import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "PARENT" || !user.familyId) {
    return NextResponse.json([]);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const quests = await prisma.questInstance.findMany({
    where: {
      status: { in: ["APPROVED", "SKIPPED"] },
      approvedAt: {
        gte: today,
        lt: tomorrow,
      },
      template: { familyId: user.familyId },
    },
    include: {
      child: {
        select: { name: true, monsterName: true, side: true },
      },
      template: {
        select: { title: true, emoji: true, category: true, difficulty: true, isTemporary: true },
      },
    },
    orderBy: { approvedAt: "desc" },
  });

  return NextResponse.json(quests);
}
