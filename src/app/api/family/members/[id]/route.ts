import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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

  // RESTRICT FK のため手動削除: QuestInstance → Streak → User（トランザクション）
  await prisma.$transaction([
    prisma.questInstance.deleteMany({ where: { childId: id } }),
    prisma.streak.deleteMany({ where: { childId: id } }),
    // TaskTemplate.assignedChildId は ON DELETE SET NULL で自動的に null になる
    prisma.user.delete({ where: { id } }),
  ]);

  return NextResponse.json({ ok: true });
}
