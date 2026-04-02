import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { routeLogger } from "@/lib/logger";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const rlog = routeLogger("DELETE", "/api/family/members/[id]");
  const user = await getCurrentUser();
  if (!user || user.role !== "PARENT" || !user.familyId) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const { id } = await params;

  // 同じファミリーの子供か確認
  const child = await prisma.user.findFirst({
    where: { id, familyId: user.familyId, role: "CHILD" },
  });
  if (!child) {
    return NextResponse.json({ error: "ユーザーが見つかりません" }, { status: 404 });
  }

  // RESTRICT FK のため手動削除順: QuestInstance → Streak → TaskStreak → TaskTemplate(null化) → User
  await prisma.$transaction([
    prisma.questInstance.deleteMany({ where: { childId: id } }),
    prisma.streak.deleteMany({ where: { childId: id } }),
    prisma.taskStreak.deleteMany({ where: { childId: id } }),
    prisma.taskTemplate.updateMany({ where: { assignedChildId: id }, data: { assignedChildId: null } }),
    prisma.user.delete({ where: { id } }),
  ]);

  rlog.warn("Family member deleted", { deletedChildId: id, familyId: user.familyId, userId: user.id });
  return NextResponse.json({ ok: true });
}
