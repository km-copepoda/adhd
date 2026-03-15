import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !user.familyId) {
    return NextResponse.json([], { status: 200 });
  }

  const tasks = await prisma.taskTemplate.findMany({
    where: { familyId: user.familyId, isActive: true },
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
          : (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })()
        : null,
      createdBy: user.role,
      familyId: user.familyId,
    },
  });

  return NextResponse.json(task);
}
