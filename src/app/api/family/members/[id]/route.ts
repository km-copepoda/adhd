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

  // 旧スキーマ（TaskStreak テーブル）が残存しているか確認
  const legacyTableRows = await prisma.$queryRaw<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'TaskStreak'
    ) AS exists
  `;
  const hasLegacyTaskStreak = legacyTableRows[0]?.exists ?? false;

  // RESTRICT FK のため手動削除順: QuestInstance → Streak/TaskStreak → TaskTemplate(null化) → User
  await prisma.$transaction(async (tx) => {
    await tx.questInstance.deleteMany({ where: { childId: id } });
    await tx.streak.deleteMany({ where: { childId: id } });
    if (hasLegacyTaskStreak) {
      await tx.$executeRaw`DELETE FROM "TaskStreak" WHERE "childId" = ${id}`;
    }
    await tx.taskTemplate.updateMany({ where: { assignedChildId: id }, data: { assignedChildId: null } });
    await tx.user.delete({ where: { id } });
  });

  return NextResponse.json({ ok: true });
}
