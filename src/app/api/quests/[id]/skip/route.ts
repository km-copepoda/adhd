import { NextResponse, after } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { sendPushToParent } from "@/lib/push";
import { routeLogger } from "@/lib/logger";
import { triggerTaskProgressLog } from "@/lib/bulletinLog";
import { computeCompletedCount, computeSkippedCount } from "@/lib/questProgress";
import { generateTreasuresOnReport } from "@/lib/treasureService";
import { resolveTreasureDate } from "@/lib/treasureDate";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const rlog = routeLogger("POST", "/api/quests/[id]/skip");
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const commentText = typeof body.comment === "string" ? body.comment.trim() : "";

  if (!commentText) {
    return NextResponse.json({ error: "スキップ理由を入力してください" }, { status: 400 });
  }

  const { id } = await params;

  const quest = await prisma.questInstance.findUnique({
    where: { id, childId: user.id },
    include: { template: true },
  });

  if (!quest) {
    return NextResponse.json({ error: "クエストが見つかりません" }, { status: 404 });
  }

  // 差し戻し後 (REJECTED) からもスキップ申請を許可する。子供が「やっぱり今日は無理」と
   // 判断した場合の逃げ道を塞がないため。report ルートと同じく rejectionReason はクリア。
  if (quest.status !== "PENDING" && quest.status !== "REJECTED") {
    return NextResponse.json({ error: "PENDINGまたはREJECTEDのクエストのみスキップできます" }, { status: 400 });
  }

  const now = new Date();

  await prisma.questInstance.update({
    where: { id },
    data: {
      status: "SKIP_REPORTED",
      comment: commentText,
      reportedAt: now,
      rejectionReason: null,
    },
  });

  // 親に通知
  if (user.familyId) {
    const parent = await prisma.user.findFirst({
      where: { familyId: user.familyId, role: "PARENT" },
    });
    if (parent) {
      const childName = user.monsterName ?? user.name ?? "子供";
      const questTitle = quest.snapshotTitle ?? quest.template.title;
      await sendPushToParent(parent.id, {
        title: "😴 スキップ申請",
        body: `${childName}が「${questTitle}」のスキップを申請しました`,
        url: "/app/parent/approve",
      });
    }
  }

  // 宝箱生成: スキップ申請も SKIP_REPORTED として完了扱いに含まれる。
  // carryOver の古日付スキップは今日基準に切替（report と同じ理由。詳細は report ルート参照）。
  const aggregationDate = resolveTreasureDate(quest.date, !!quest.template?.carryOver, now);
  const isCarryOverPastSkip = aggregationDate.getTime() !== quest.date.getTime();
  // template.isActive / pausedAt でフィルタして子供画面のタスク集合と揃える
  // (詳細は report ルートのコメント参照)
  const sameDateQuests = await prisma.questInstance.findMany({
    where: {
      childId: user.id,
      date: aggregationDate,
      template: { isActive: true, pausedAt: null },
    },
    select: { status: true },
  });
  const aggregateQuests = isCarryOverPastSkip
    ? [...sameDateQuests, { status: "SKIP_REPORTED" as const }]
    : sameDateQuests;
  const treasureIds = await generateTreasuresOnReport({
    childId: user.id,
    date: aggregationDate,
    reportedCount: computeCompletedCount(aggregateQuests),
    totalCount: aggregateQuests.length,
    skippedCount: computeSkippedCount(aggregateQuests),
    minTasks: user.minTasksForStreak,
    isProxy: false,
  });

  // 掲示板ログ — スキップも「done」扱いなので進捗を再評価する。after() でレスポンス後実行
  after(() => triggerTaskProgressLog(user.id).catch(() => {}));

  rlog.info("Skip requested", { questId: id, childId: user.id, treasureIds });
  return NextResponse.json({ ok: true, treasureIds });
}
