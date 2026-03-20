import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { sendPushToChild } from "@/lib/push";
import { routeLogger } from "@/lib/logger";

export async function POST(request: Request) {
  const rlog = routeLogger("POST", "/api/push/notify-child");
  const user = await getCurrentUser();
  if (!user || user.role !== "PARENT" || !user.familyId) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const { childId, taskId } = await request.json();
  if (!childId) {
    return NextResponse.json({ error: "childIdが必要です" }, { status: 400 });
  }

  // 対象の子供が同じファミリーか確認
  const child = await prisma.user.findFirst({
    where: { id: childId, familyId: user.familyId, role: "CHILD" },
  });
  if (!child) {
    return NextResponse.json({ error: "対象の子供が見つかりません" }, { status: 403 });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayOfWeek = today.getDay();
  
  // QuestInstance は子供がアプリを開いたときに遅延生成されるため、
  // 親がリマインドを送る時点で未精製の可能性があるので、先に生成する
  const templates = await prisma.taskTemplate.findMany({
    where: {
      familyId: user.familyId,
      assignedChildId: childId,
      isActive: true,
      OR: [
        { isTemporary: false, createdBy: "PARENT", repeatDays: { has: dayOfWeek } },
        { isTemporary: false, createdBy: "CHILD", requestedDate: today, repeatDays: { has: dayOfWeek } },
        { isTemporary: true, targetDate: today },
      ],
    },
  });
  await Promise.all(
    templates.map((template) =>
      prisma.questInstance.upsert({
        where: {
          templateId_childId_date: {
            templateId: template.id,
            childId,
            date: today,
          },
        },
        update: {},
        create: {
          templateId: template.id,
          childId,
          date: today,
        },
      })
    )
  );

  if (taskId) {
    // 特定タスクへのリマインド
    const quest = await prisma.questInstance.findFirst({
      where: { id: taskId, childId, status: "PENDING" },
      include: { template: { select: { title: true } } },
    });
    if (!quest) {
      return NextResponse.json({ error: "対象のクエストが見つかりません" }, { status: 404 });
    }
    await sendPushToChild(childId, {
      title: "⏰ リマインド",
      body: `「${quest.template.title}」がまだ終わってないよ！`,
      url: "/child/quests",
    });
  } else {
    // 未完了タスク一覧をまとめて通知
    const pendingQuests = await prisma.questInstance.findMany({
      where: { childId, status: "PENDING", date: today },
      include: { template: { select: { title: true } } },
    });
    if (pendingQuests.length === 0) {
      return NextResponse.json({ error: "未完了のクエストがありません" }, { status: 400 });
    }
    const taskNames = pendingQuests.map((q) => q.template.title).join("、");
    await sendPushToChild(childId, {
      title: "⏰ リマインド",
      body: `${taskNames}がまだ終わってないよ！`,
      url: "/child/quests",
    });
  }

  rlog.info("Reminder sent", { childId, taskId: taskId || "all", userId: user.id });
  return NextResponse.json({ ok: true });
}
