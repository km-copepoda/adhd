import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const parent = await getCurrentUser();
  if (!parent) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }
  if (parent.role !== "PARENT" || !parent.familyId) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const children = await prisma.user.findMany({
    where: { familyId: parent.familyId, role: "CHILD" },
    select: {
      id: true,
      name: true,
      monsterName: true,
      side: true,
      evolutionStage: true,
      evolutionPath: true,
      studyPt: true,
      staminaPt: true,
      lifePt: true,
      collectedPaths: true,
      rebirthEggBonus: true,
      monsterSetId: true,
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(children);
}
