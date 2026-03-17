import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

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

  // PARENT: return all family tasks with assignedChild info
  const tasks = await prisma.taskTemplate.findMany({
    where: { familyId: user.familyId, isActive: true },
    include: {
      assignedChild: { select: { id: true, monsterName: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(tasks);
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !user.familyId) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const body = await request.json();
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

  const todayDate = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })();

  const task = await prisma.taskTemplate.create({
    data: {
      title: body.title,
      emoji: body.emoji || "⚔️",
      category: body.category,
      difficulty: body.difficulty,
      repeatDays: isTemporary ? [] : (body.repeatDays ?? []),
      isTemporary,
      targetDate: isTemporary
        ? body.targetDate
          ? new Date(body.targetDate)
          : todayDate
        : null,
      // 子供が作成した通常タスクは申請日を記録（日付をまたいでも当日のみ表示するため）
      requestedDate: !isTemporary && user.role === "CHILD" ? todayDate : null,
      createdBy: user.role,
      familyId: user.familyId,
      assignedChildId,
    },
  });

  return NextResponse.json(task);
}
