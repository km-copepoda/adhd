import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { routeLogger } from "@/lib/logger";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const rlog = routeLogger("PUT", "/api/tasks/[id]");
  const user = await getCurrentUser();
  if (!user || user.role !== "PARENT") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }
  if (!user.familyId) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const task = await prisma.taskTemplate.update({
    where: { id, familyId: user.familyId },
    data: {
      title: body.title,
      emoji: body.emoji,
      category: body.category,
      repeatDays: body.repeatDays,
      photoBonus: body.photoBonus,
    },
  });

  rlog.info("Task updated", { taskId: id, userId: user.id });
  return NextResponse.json(task);
}

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const rlog = routeLogger("PATCH", "/api/tasks/[id]");
  const user = await getCurrentUser();
  if (!user || user.role !== "PARENT") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const { id } = await params;
  const task = await prisma.taskTemplate.update({
    where: { id, familyId: user.familyId ?? undefined },
    data: { createdBy: "PARENT" },
  });

  rlog.info("Child task approved by parent", { taskId: id, userId: user.id });
  return NextResponse.json(task);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const rlog = routeLogger("DELETE", "/api/tasks/[id]");
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const { id } = await params;

  // 子供は自分が作成した一時タスクのみ削除可能
  if (user.role === "CHILD") {
    const task = await prisma.taskTemplate.findFirst({
      where: { id, createdBy: "CHILD", familyId: user.familyId ?? undefined },
    });
    if (!task) {
      return NextResponse.json({ error: "権限がありません" }, { status: 403 });
    }
  }

  // 仮タスク（createdBy: CHILD）を親が却下する場合、完了済みクエストのXPを差し引く
  if (user.role === "PARENT") {
    const task = await prisma.taskTemplate.findUnique({
      where: { id },
      include: {
        quests: {
          where: { status: { in: ["REPORTED", "APPROVED"] } },
          include: { child: true },
        },
      },
    });

    if (task?.createdBy === "CHILD" && task.quests.length > 0) {
      const category = task.category;

      // APPROVED のクエストのみXPが付与済み（REPORTEDはまだ未付与）
      const approvedQuests = task.quests.filter(q => q.status === "APPROVED");
      let totalXp = 0;
      for (const quest of approvedQuests) {
        let xp = 1;
        if (quest.deadlineBonusEarned) xp++;
        if (task.photoBonus && quest.photoUrl) xp++;
        totalXp += xp;
      }

      // 最新のchildデータを取得してXPを一括差し引き（stale data を避ける）
      if (totalXp > 0) {
        const childId = task.quests[0].childId;
        const freshChild = await prisma.user.findUnique({ where: { id: childId } });
        if (freshChild) {
          await prisma.user.update({
            where: { id: childId },
            data: {
              studyPt: Math.max(0, freshChild.studyPt - (category === "STUDY" ? totalXp : 0)),
              staminaPt: Math.max(0, freshChild.staminaPt - (category === "STAMINA" ? totalXp : 0)),
              lifePt: Math.max(0, freshChild.lifePt - (category === "LIFE" ? totalXp : 0)),
            },
          });
        }
      }

      // 全クエスト（REPORTED + APPROVED）のステータスを一括更新
      await prisma.questInstance.updateMany({
        where: { id: { in: task.quests.map(q => q.id) } },
        data: { status: "REJECTED" },
      });

      rlog.warn("XP clawback on task rejection", {
        taskId: id,
        category,
        clawbackXp: totalXp,
        questCount: task.quests.length,
        userId: user.id,
      });
    }
  }

  await prisma.taskTemplate.update({
    where: { id },
    data: { isActive: false },
  });

  rlog.info("Task soft-deleted", { taskId: id, userId: user.id, role: user.role });
  return NextResponse.json({ ok: true });
}
