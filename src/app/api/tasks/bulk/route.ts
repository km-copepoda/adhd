import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { CATEGORY_LABEL } from "@/lib/categories";
import type { Category } from "@/types";

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
