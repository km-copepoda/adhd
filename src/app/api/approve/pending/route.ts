import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { routeLogger } from "@/lib/logger";
import { cleanupStaleCarryOverInstances } from "@/lib/quests";

export async function GET() {
  const rlog = routeLogger("GET", "/api/approve/pending");
  const user = await getCurrentUser();
  if (!user || user.role !== "PARENT" || !user.familyId) {
    return NextResponse.json([]);
  }

  // carryOver を後から ON にした際の stale REPORTED/PENDING を遅延クリーンアップ
  const children = await prisma.user.findMany({
    where: { familyId: user.familyId, role: "CHILD" },
    select: { id: true },
  });
  for (const child of children) {
    const carryOverTemplates = await prisma.taskTemplate.findMany({
      where: {
        familyId: user.familyId,
        assignedChildId: child.id,
        isActive: true,
        carryOver: true,
      },
      select: { id: true, carryOver: true },
    });
    await cleanupStaleCarryOverInstances({ childId: child.id, templates: carryOverTemplates });
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
