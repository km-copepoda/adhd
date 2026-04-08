import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "PARENT" || !user.familyId) {
    return NextResponse.json({ approvals: 0, tasks: 0 });
  }

  const [approvals, tasks] = await Promise.all([
    prisma.questInstance.count({
      where: {
        OR: [{ status: "REPORTED" }, { status: "SKIP_REPORTED" }],
        template: { familyId: user.familyId },
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

  return NextResponse.json({ approvals, tasks });
}
