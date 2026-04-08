import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "PARENT" || !user.familyId) {
    return NextResponse.json({ count: 0 });
  }

  const count = await prisma.questInstance.count({
    where: {
      OR: [{ status: "REPORTED" }, { status: "SKIP_REPORTED" }],
      template: { familyId: user.familyId },
    },
  });

  return NextResponse.json({ count });
}
