import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { routeLogger } from "@/lib/logger";

export async function GET() {
  const rlog = routeLogger("GET", "/api/approve/pending");
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
        select: { name: true, monsterName: true, side: true, reportDeadlineTime: true },
      },
      template: {
        select: { title: true, emoji: true, category: true, isTemporary: true, photoBonus: true },
      },
    },
    orderBy: { reportedAt: "desc" },
  });

  rlog.info("Pending approvals fetched", { userId: user.id, familyId: user.familyId, count: quests.length });
  return NextResponse.json(quests);
}
