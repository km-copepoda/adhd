import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { routeLogger } from "@/lib/logger";
import { todayJST } from "@/lib/date";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const rlog = routeLogger("POST", "/api/tasks/[id]/copy");
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
    const tomorrow = todayJST();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    targetDate = tomorrow;
  }

  const existing = await prisma.taskTemplate.findFirst({
    where: {
      familyId: original.familyId,
      assignedChildId: original.assignedChildId,
      title: original.title,
      isTemporary: true,
      targetDate,
    },
  });
  if (existing) {
    rlog.info("Duplicate copy skipped", { originalId: id, existingId: existing.id, targetDate: targetDate.toISOString() });
    return NextResponse.json(existing);
  }

  const newTask = await prisma.taskTemplate.create({
    data: {
      title: original.title,
      emoji: original.emoji,
      category: original.category,
      repeatDays: [],
      isTemporary: true,
      targetDate,
      createdBy: "PARENT",
      familyId: original.familyId,
      assignedChildId: original.assignedChildId,
    },
  });

  rlog.info("Task copied", { originalId: id, newId: newTask.id, targetDate: targetDate.toISOString() });
  return NextResponse.json(newTask);
}
