import { NextResponse, after } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { approveSkipQuestInstance } from "@/lib/approve";
import { resolveTargetChild } from "@/lib/parentChildView";
import { triggerTaskProgressLog } from "@/lib/bulletinLog";
import { routeLogger } from "@/lib/logger";
import { computeCompletedCount, computeSkippedCount } from "@/lib/questProgress";
import { generateProxyTreasure } from "@/lib/treasureService";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const rlog = routeLogger("POST", "/api/parent/child-view/quests/[id]/skip-approve");
  const parent = await getCurrentUser();
  if (!parent) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const { childId, comment } = body ?? {};

  const commentText = typeof comment === "string" ? comment.trim() : "";
  if (!commentText) {
    return NextResponse.json({ error: "スキップ理由を入力してください" }, { status: 400 });
  }

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

  // 親代理スキップで許可する遷移元: PENDING / SKIP_REPORTED の 2 通り。
  // 報告経路（REPORTED）/ 既終了（APPROVED, SKIPPED, REJECTED）はスキップ確定の入口にしない。
  if (quest.status !== "PENDING" && quest.status !== "SKIP_REPORTED") {
    return NextResponse.json({ error: "このクエストはスキップできません" }, { status: 400 });
  }

  // 報告フィールドを書き込む。子供本人のスキップ申請と同じく comment（理由）と reportedAt を埋める。
  // SKIP_REPORTED から来た場合は reportedAt 既存値を保つ。
  await prisma.questInstance.update({
    where: { id },
    data: {
      comment: commentText,
      reportedAt: quest.reportedAt ?? new Date(),
    },
  });

  // 親代理「即 SKIPPED」: SKIP_REPORTED を経由せず一気に SKIPPED まで確定（report-approve と同じ思想）
  await approveSkipQuestInstance({ id: quest.id, childId: child.id, date: quest.date });

  // PROXY / ALL_COMPLETE 宝箱: minTasks 到達 or 全完了で即 UNLOCKED 生成（report-approve と同規約）
  const minTasks = (child as unknown as { minTasksForStreak?: number }).minTasksForStreak ?? 1;
  const todayQuests = await prisma.questInstance.findMany({
    where: { childId: child.id, date: quest.date },
    select: { status: true },
  });
  const reportedCount = computeCompletedCount(todayQuests);
  const skippedCount = computeSkippedCount(todayQuests);
  const treasureIds =
    reportedCount >= minTasks
      ? await generateProxyTreasure({
          childId: child.id,
          date: quest.date,
          reportedCount,
          totalCount: todayQuests.length,
          skippedCount,
          minTasks,
        })
      : [];

  // 掲示板の TASK_* 進捗ログ: スキップも computeCompletedCount に含まれるため、子供本人の
  // スキップ申請と同じく進捗マイルストーンが落ちる可能性がある。代理経路でも発火する。
  after(() => triggerTaskProgressLog(child.id).catch(() => {}));

  rlog.info("Parent proxy-skipped on behalf of child", {
    questId: id,
    childId: child.id,
    parentId: parent.id,
    treasureIds,
  });
  return NextResponse.json({ ok: true, treasureIds });
}
