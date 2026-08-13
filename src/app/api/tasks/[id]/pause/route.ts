import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { routeLogger } from "@/lib/logger";
import { getFamilyPlan, countActiveTasksForChild } from "@/lib/subscriptionService";
import { checkLimit } from "@/lib/subscription";
import { closedPauseInterval } from "@/lib/taskSummary";

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

  // 現在の状態を先に取得して冪等性を担保する:
  //  - paused=true が重複到達しても既存 pausedAt を上書きしない（stale リクエスト対策）
  //  - paused=false 時は pauseIntervals に今回停止分を追記し、プラン上限チェックを再確認
  const target = await prisma.taskTemplate.findUnique({
    where: { id, familyId: user.familyId },
    select: { assignedChildId: true, pausedAt: true, pauseIntervals: true },
  });
  if (!target) {
    return NextResponse.json({ error: "タスクが見つかりません" }, { status: 404 });
  }

  let appendedIntervals: { start: string; end: string }[] | null = null;
  let nextPausedAt: Date | null;
  if (body.paused) {
    // 既に停止中なら pausedAt を保持（冪等）。未停止なら現在時刻をセット。
    nextPausedAt = target.pausedAt ?? new Date();
  } else {
    nextPausedAt = null;
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
    // 実際に停止中だった場合のみインターバルを追記（重複再開の防御）
    if (target.pausedAt) {
      const prior = Array.isArray(target.pauseIntervals)
        ? (target.pauseIntervals as { start: string; end: string }[])
        : [];
      const closed = closedPauseInterval(target.pausedAt, new Date());
      appendedIntervals = [
        ...prior,
        { start: closed.start.toISOString(), end: closed.end.toISOString() },
      ];
    }
  }

  const task = await prisma.taskTemplate.update({
    where: { id, familyId: user.familyId },
    data: {
      pausedAt: nextPausedAt,
      ...(appendedIntervals ? { pauseIntervals: appendedIntervals } : {}),
    },
  });

  rlog.info("Task pause state updated", { taskId: id, paused: body.paused, userId: user.id });
  return NextResponse.json(task);
}
