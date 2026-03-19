import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "PARENT" || !user.familyId) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const { id } = await params;

  const original = await prisma.taskTemplate.findFirst({
    where: { id, familyId: user.familyId },
  });

  if (!original) {
    return NextResponse.json({ error: "タスクが見つかりません" }, { status: 404 });
  }

  if (!original.isTemporary) {
    return NextResponse.json({ error: "一時タスクのみコピーできます" }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));

  let targetDate: Date;
  if (body.targetDate) {
    targetDate = new Date(body.targetDate);
  } else {
    const tomorrow = new Date();
    tomorrow.setHours(0, 0, 0, 0);
    tomorrow.setDate(tomorrow.getDate() + 1);
    targetDate = tomorrow;
  }

  const newTask = await prisma.taskTemplate.create({
    data: {
      title: original.title,
      emoji: original.emoji,
      category: original.category,
      difficulty: original.difficulty,
      repeatDays: [],
      isTemporary: true,
      targetDate,
      createdBy: "PARENT",
      familyId: original.familyId,
      assignedChildId: original.assignedChildId,
    },
  });

  return NextResponse.json(newTask);
}
