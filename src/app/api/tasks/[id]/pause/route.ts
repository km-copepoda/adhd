import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { routeLogger } from "@/lib/logger";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const rlog = routeLogger("POST", "/api/tasks/[id]/pause");
  const user = await getCurrentUser();
  if (!user || user.role !== "PARENT" || !user.familyId) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  if (typeof body.paused !== "boolean") {
    return NextResponse.json({ error: "paused (boolean) は必須です" }, { status: 400 });
  }

  const task = await prisma.taskTemplate.update({
    where: { id, familyId: user.familyId },
    data: { pausedAt: body.paused ? new Date() : null },
  });

  rlog.info("Task pause state updated", { taskId: id, paused: body.paused, userId: user.id });
  return NextResponse.json(task);
}
