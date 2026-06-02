import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { sendPushToParent } from "@/lib/push";
import { routeLogger } from "@/lib/logger";
import { todayJST } from "@/lib/date";
import { getParentTaskSummaries } from "@/lib/taskSummary";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !user.familyId) {
    return NextResponse.json([], { status: 200 });
  }

  if (user.role === "CHILD") {
    const tasks = await prisma.taskTemplate.findMany({
      where: { assignedChildId: user.id, isActive: true },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(tasks);
  }

  const summaries = await getParentTaskSummaries(user.familyId);
  return NextResponse.json(summaries);
}

export async function POST(request: Request) {
  const rlog = routeLogger("POST", "/api/tasks");
  const user = await getCurrentUser();
  if (!user || !user.familyId) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const body = await request.json();

  if (!body.title || typeof body.title !== "string" || body.title.trim().length === 0) {
    return NextResponse.json({ error: "タスク名は必須です" }, { status: 400 });
  }
  if (body.title.length > 32) {
    return NextResponse.json({ error: "タスク名は32文字以内にしてください" }, { status: 400 });
  }

  const isTemporary: boolean = body.isTemporary === true;

  // CHILD: always assign to self
  // PARENT: require assignedChildId
  let assignedChildId: string;
  if (user.role === "CHILD") {
    assignedChildId = user.id;
  } else {
    if (!body.assignedChildId) {
      return NextResponse.json({ error: "assignedChildId は必須です" }, { status: 400 });
    }
    assignedChildId = body.assignedChildId;
  }

  const todayDate = todayJST();

  const task = await prisma.taskTemplate.create({
    data: {
      title: body.title,
      emoji: body.emoji || "⚔️",
      category: body.category,
      repeatDays: isTemporary ? [] : (body.repeatDays ?? []),
      isTemporary,
      targetDate: isTemporary
        ? body.targetDate
          ? new Date(body.targetDate)
          : todayDate
        : null,
      // 子供が作成した通常タスクは申請日を記録（日付をまたいでも当日のみ表示するため）
      requestedDate: !isTemporary && user.role === "CHILD" ? todayDate : null,
      photoBonus: body.photoBonus === true,
      carryOver: user.role === "PARENT" && body.carryOver === true,
      createdBy: user.role,
      originalCreatedBy: user.role,
      familyId: user.familyId,
      assignedChildId,
    },
  });

  // 子供がタスクを申請した場合、親に通知
  if (user.role === "CHILD" && user.familyId) {
    const parent = await prisma.user.findFirst({
      where: { familyId: user.familyId, role: "PARENT" },
    });
    if (parent) {
      const childName = user.monsterName ?? user.name ?? "子供";
      await sendPushToParent(parent.id, {
        title: "📋 タスク申請",
        body: `${childName}が「${task.title}」を申請しました`,
        url: "/app/parent/tasks",
      });
    }
  }

  rlog.info("Task created", {
    taskId: task.id,
    userId: user.id,
    role: user.role,
    isTemporary: String(isTemporary),
    assignedChildId,
    familyId: user.familyId,
  });
  return NextResponse.json(task);
}
