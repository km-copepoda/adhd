import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { routeLogger } from "@/lib/logger";
import { getFamilyPlan, countActiveTasksForChild } from "@/lib/subscriptionService";
import { checkLimit } from "@/lib/subscription";

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

  // 再開 (paused=false) 時のみプラン上限を再確認する。停止は無制限。
  if (body.paused === false) {
    const target = await prisma.taskTemplate.findUnique({
      where: { id, familyId: user.familyId },
      select: { assignedChildId: true },
    });
    if (!target) {
      return NextResponse.json({ error: "タスクが見つかりません" }, { status: 404 });
    }
    if (target.assignedChildId) {
      const plan = await getFamilyPlan(user.familyId);
      const activeCount = await countActiveTasksForChild(target.assignedChildId);
      const limitCheck = checkLimit(plan, "task", activeCount);
      if (!limitCheck.allowed) {
        return NextResponse.json(
          {
            error: `無料プランではタスクは${limitCheck.limit}個までです。プレミアムプランで無制限になります。`,
            code: "PLAN_LIMIT_EXCEEDED",
            resource: "task",
            current: limitCheck.current,
            limit: limitCheck.limit,
          },
          { status: 403 },
        );
      }
    }
  }

  const task = await prisma.taskTemplate.update({
    where: { id, familyId: user.familyId },
    data: { pausedAt: body.paused ? new Date() : null },
  });

  rlog.info("Task pause state updated", { taskId: id, paused: body.paused, userId: user.id });
  return NextResponse.json(task);
}
