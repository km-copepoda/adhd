import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "PARENT" || !user.familyId) {
    return NextResponse.json([]);
  }

  const quests = await prisma.questInstance.findMany({
    where: {
      OR: [{ status: "REPORTED" }, { status: "SKIP_REPORTED" }],
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
    orderBy: { reportedAt: "desc" },
  });

  return NextResponse.json(quests);
}
