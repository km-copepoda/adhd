import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function POST() {
  const user = await getCurrentUser();
  if (!user || user.role !== "CHILD") {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const member = await prisma.gatheringMember.findUnique({
    where: { childId: user.id },
  });
  if (!member) {
    return NextResponse.json({ error: "グループに参加していません" }, { status: 404 });
  }

  await prisma.gatheringMember.delete({ where: { childId: user.id } });

  return NextResponse.json({ ok: true });
}
