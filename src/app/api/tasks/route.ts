import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { sendPushToParent } from "@/lib/push";
import { routeLogger } from "@/lib/logger";
import { todayJST } from "@/lib/date";
import { ensureTodayQuests } from "@/lib/quests";

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

  // PARENT: 子供が画面を開いていなくても今日のクエストを materialize しておく。
  // （carryOver フラグ付きタスクの「忘れた→翌日持ち越し」が、子供が一度もアクセスしなくても機能するように）
  const children = await prisma.user.findMany({
    where: { familyId: user.familyId, role: "CHILD" },
    select: { id: true },
  });
  await Promise.all(
    children.map((c) => ensureTodayQuests({ childId: c.id, familyId: user.familyId! }))
  );

  // PARENT: return all family tasks with assignedChild info
  const tasks = await prisma.taskTemplate.findMany({
    where: { familyId: user.familyId, isActive: true },
    include: {
      assignedChild: { select: { id: true, monsterName: true } },
      taskStreaks: {
        select: { childId: true, currentStreak: true, bestStreak: true, lastAchievedDate: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const today = todayJST();
  const taskIds = tasks.map((t) => t.id);
  const completedQuests = await prisma.questInstance.findMany({
    where: {
      templateId: { in: taskIds },
      date: today,
      status: { in: ["APPROVED", "SKIPPED"] },
    },
    select: { templateId: true },
  });
  const completedSet = new Set(completedQuests.map((q) => q.templateId));

  // 直近7日間のSKIPPEDを取得（該当曜日でない日にも親がスキップに気づけるよう、タスクカードにバッジ表示するため）
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);
  const recentSkipped = await prisma.questInstance.findMany({
    where: {
      templateId: { in: taskIds },
      status: "SKIPPED",
      date: { gte: sevenDaysAgo, lte: today },
    },
    select: { templateId: true, date: true },
    orderBy: { date: "desc" },
  });
  const lastSkippedMap = new Map<string, Date>();
  for (const q of recentSkipped) {
    if (!lastSkippedMap.has(q.templateId) && q.date) {
      lastSkippedMap.set(q.templateId, q.date);
    }
  }

  // carryOver=true タスクの「過去から持ち越し中のPENDING」を検出（親画面で未完了放置を可視化するため）
  const carryOverTaskIds = tasks.filter((t) => (t as { carryOver?: boolean }).carryOver).map((t) => t.id);
  const oldestPendingMap = new Map<string, Date>();
  if (carryOverTaskIds.length > 0) {
    const carryOverPending = await prisma.questInstance.findMany({
      where: {
        templateId: { in: carryOverTaskIds },
        status: "PENDING",
        date: { lt: today },
      },
      select: { templateId: true, date: true },
      orderBy: { date: "asc" },
    });
    // 直近の APPROVED/SKIPPED より古い PENDING は stale データとして無視する
    // （carryOver を後から ON にした等で、完了済みより古い PENDING が DB に残っているケース）
    const latestSettled = await prisma.questInstance.findMany({
      where: {
        templateId: { in: carryOverTaskIds },
        status: { in: ["APPROVED", "SKIPPED"] },
      },
      select: { templateId: true, date: true },
      orderBy: { date: "desc" },
    });
    const latestSettledMap = new Map<string, Date>();
    for (const q of latestSettled) {
      if (!latestSettledMap.has(q.templateId) && q.date) {
        latestSettledMap.set(q.templateId, q.date);
      }
    }
    for (const q of carryOverPending) {
      if (!q.date) continue;
      const settled = latestSettledMap.get(q.templateId);
      if (settled && q.date <= settled) continue;
      if (!oldestPendingMap.has(q.templateId)) {
        oldestPendingMap.set(q.templateId, q.date);
      }
    }
  }

  return NextResponse.json(
    tasks.map((t) => ({
      ...t,
      completedToday: completedSet.has(t.id),
      lastSkippedDate: lastSkippedMap.get(t.id) ?? null,
      oldestCarryOverPendingDate: oldestPendingMap.get(t.id) ?? null,
    }))
  );
}

export async function POST(request: Request) {
  const rlog = routeLogger("POST", "/api/tasks");
  const user = await getCurrentUser();
  if (!user || !user.familyId) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const body = await request.json();
  
  if (!body.title || typeof body.title !== "string" || body.title.trim().length === 0 ) {
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
