import { NextResponse, after } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { isBeforeDeadline } from "@/lib/date";
import { approveQuestInstance } from "@/lib/approve";
import { resolveTargetChild } from "@/lib/parentChildView";
import { triggerTaskProgressLog } from "@/lib/bulletinLog";
import { routeLogger } from "@/lib/logger";
import { computeCompletedCount, computeSkippedCount } from "@/lib/questProgress";
import { generateProxyTreasure } from "@/lib/treasureService";
import { resolveTreasureDate } from "@/lib/treasureDate";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const rlog = routeLogger("POST", "/api/parent/child-view/quests/[id]/report-approve");
  const parent = await getCurrentUser();
  if (!parent) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { childId, comment, photoUrl, stamp } = body ?? {};

  const resolved = await resolveTargetChild(parent, childId);
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }
  const child = resolved.child;

  const quest = await prisma.questInstance.findUnique({
    where: { id },
    include: { template: true, child: true },
  });

  if (!quest || quest.childId !== child.id) {
    return NextResponse.json({ error: "クエストが見つかりません" }, { status: 404 });
  }

  // 親の代理操作で許可するステータス: PENDING（未報告）/ REJECTED（差し戻し後）/ REPORTED（子供報告済み）
  // 既に APPROVED / SKIPPED / SKIP_REPORTED は対象外（不正な遷移）
  if (
    quest.status !== "PENDING" &&
    quest.status !== "REJECTED" &&
    quest.status !== "REPORTED"
  ) {
    return NextResponse.json({ error: "このクエストは操作できません" }, { status: 400 });
  }

  const now = new Date();

  // 期限ボーナス: 初回（PENDING）のみ判定。REJECTED 再報告・REPORTED は既存値を保持
  let deadlineBonusEarned: boolean | undefined;
  if (quest.status === "PENDING") {
    const deadlineTime = child.reportDeadlineTime ?? null;
    deadlineBonusEarned = deadlineTime
      ? isBeforeDeadline(now, quest.date, deadlineTime)
      : false;
  }

  // まず報告フィールドを書き込む（コメント・写真・reportedAt）
  await prisma.questInstance.update({
    where: { id },
    data: {
      comment: comment ?? null,
      photoUrl: photoUrl ?? quest.photoUrl,
      reportedAt: quest.reportedAt ?? now,
      rejectionReason: null,
      ...(deadlineBonusEarned !== undefined ? { deadlineBonusEarned } : {}),
    },
  });

  // 既に書き込み済みの値を反映した quest オブジェクトを approveQuestInstance に渡す
  // reportedAt も実際に DB へ書き込んだ値（既存値優先、なければ now）と揃える。
  // approveQuestInstance 内の resolveTreasureDate が quest.reportedAt を基準にするため。
  const updatedQuest = {
    ...quest,
    deadlineBonusEarned:
      deadlineBonusEarned !== undefined ? deadlineBonusEarned : quest.deadlineBonusEarned,
    photoUrl: photoUrl ?? quest.photoUrl,
    reportedAt: quest.reportedAt ?? now,
  };

  // approveQuestInstance が status=APPROVED への更新・XP付与・進化・バッジ・掲示板ログ（EVOLVED/BADGE）を一気に処理する
  await approveQuestInstance(updatedQuest, stamp ?? undefined);

  // 親代理経路でも PROXY / ALL_COMPLETE 宝箱を即 UNLOCKED で生成する。
  // (2026-07-02) 全完了時に子セルフ経路と同じ ALL_COMPLETE ボーナスも出すように変更。
  // carryOver 過去日付は子セルフ report/skip と同じく集計を今日基準に切り替える
  // (quest.date=昨日 のまま集計すると今日のタスクが載らず ALL_COMPLETE 判定が壊れる)
  const minTasks = (child as unknown as { minTasksForStreak?: number }).minTasksForStreak ?? 1;
  const aggregationDate = resolveTreasureDate(quest.date, !!quest.template?.carryOver, now);
  const isCarryOverPast = aggregationDate.getTime() !== quest.date.getTime();
  const sameDateQuests = await prisma.questInstance.findMany({
    where: {
      childId: child.id,
      date: aggregationDate,
      template: { isActive: true, pausedAt: null },
    },
    select: { status: true },
  });
  const aggregateQuests = isCarryOverPast
    ? [...sameDateQuests, { status: "APPROVED" as const }]
    : sameDateQuests;
  const reportedCount = computeCompletedCount(aggregateQuests);
  const skippedCount = computeSkippedCount(aggregateQuests);
  const totalCount = aggregateQuests.length;
  // 少タスク日は全完了で救済（generateProxyTreasure と同じ Math.min 規約）
  const required = Math.min(minTasks, totalCount);
  const treasureIds =
    reportedCount >= required
      ? await generateProxyTreasure({
          childId: child.id,
          date: aggregationDate,
          reportedCount,
          totalCount,
          skippedCount,
          minTasks,
        })
      : [];

  // TASK_* 進捗ログは通常 /api/quests/[id]/report が発火する。代理報告でも子供本人の社会的フィードバック
  // を維持するため、ここで明示的に同等の after() 発火を行う（decisions.md 2026-05-11 / 2026-05-01）
  after(() => triggerTaskProgressLog(child.id).catch(() => {}));

  rlog.info("Parent reported-approved on behalf of child", {
    questId: id,
    childId: child.id,
    parentId: parent.id,
    treasureIds,
  });
  return NextResponse.json({ ok: true, treasureIds });
}
