import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { CATEGORY_LABEL } from "@/lib/categories";
import type { Category } from "@/types";
import { getFamilyPlan } from "@/lib/subscriptionService";
import { checkBulkLimit } from "@/lib/subscription";

type BulkTaskItem = {
  title: string;
  category: Category;
  repeatDays: number[];
};

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !user.familyId) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }
  if (user.role !== "PARENT") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const body = await request.json();

  if (!body.assignedChildId) {
    return NextResponse.json({ error: "assignedChildId は必須です" }, { status: 400 });
  }

  if (!Array.isArray(body.tasks)) {
    return NextResponse.json({ error: "tasks は配列である必要があります" }, { status: 400 });
  }

  const tasks: BulkTaskItem[] = body.tasks;

  if (tasks.length === 0) {
    return NextResponse.json({ error: "tasks は1件以上指定してください" }, { status: 400 });
  }

  if (tasks.length > 30) {
    return NextResponse.json({ error: "一度に追加できるタスクは30件までです" }, { status: 400 });
  }

  for (const task of tasks) {
    if (!task.title || task.title.trim().length === 0) {
      return NextResponse.json({ error: "タスク名は必須です" }, { status: 400 });
    }
    if (task.title.length > 32) {
      return NextResponse.json({ error: "タスク名は32文字以内にしてください" }, { status: 400 });
    }
  }

  // IDOR 防止: assignedChildId が自分の family に属する CHILD であることを確認する。
  // これが無いと親A が他 family の子供 ID を渡してタスクを付与できてしまう。
  const child = await prisma.user.findFirst({
    where: { id: body.assignedChildId, familyId: user.familyId, role: "CHILD" },
    select: { id: true },
  });
  if (!child) {
    return NextResponse.json({ error: "対象の子供が見つかりません" }, { status: 404 });
  }

  // FREE プランのタスク上限 enforce (仕様: monetization-plan.md §2.2 / §4.4)
  const plan = await getFamilyPlan(user.familyId);
  const activeCount = await prisma.taskTemplate.count({
    where: { assignedChildId: body.assignedChildId, isActive: true, pausedAt: null },
  });
  const limitCheck = checkBulkLimit(plan, "task", activeCount, tasks.length);
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

  const result = await prisma.taskTemplate.createMany({
    data: tasks.map((task) => ({
      title: task.title,
      emoji: CATEGORY_LABEL[task.category]?.emoji ?? "⚔️",
      category: task.category,
      repeatDays: task.repeatDays ?? [],
      isTemporary: false,
      targetDate: null,
      requestedDate: null,
      photoBonus: false,
      createdBy: "PARENT" as const,
      originalCreatedBy: "PARENT" as const,
      familyId: user.familyId!,
      assignedChildId: body.assignedChildId,
    })),
  });

  return NextResponse.json({ count: result.count });
}
