import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "PARENT" || !user.familyId) {
    return NextResponse.json({ approvals: 0, tasks: 0 });
  }

  const [questApprovals, treasureUseApprovals, tasks] = await Promise.all([
    prisma.questInstance.count({
      where: {
        OR: [{ status: "REPORTED" }, { status: "SKIP_REPORTED" }],
        template: { familyId: user.familyId },
      },
    }),
    // #151: ごほうび使用申請も承認待ちに合算する
    prisma.treasureLog.count({
      where: {
        useStatus: "USE_REQUESTED",
        child: { familyId: user.familyId },
      },
    }),
    prisma.taskTemplate.count({
      where: {
        familyId: user.familyId,
        isActive: true,
        createdBy: "CHILD",
      },
    }),
  ]);

  return NextResponse.json({ approvals: questApprovals + treasureUseApprovals, tasks });
}
