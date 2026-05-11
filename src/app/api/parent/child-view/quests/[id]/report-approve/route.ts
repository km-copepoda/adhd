import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { isBeforeDeadline } from "@/lib/date";
import { approveQuestInstance } from "@/lib/approve";
import { resolveTargetChild } from "@/lib/parentChildView";
import { routeLogger } from "@/lib/logger";

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
  const updatedQuest = {
    ...quest,
    deadlineBonusEarned:
      deadlineBonusEarned !== undefined ? deadlineBonusEarned : quest.deadlineBonusEarned,
    photoUrl: photoUrl ?? quest.photoUrl,
  };

  // approveQuestInstance が status=APPROVED への更新・XP付与・進化・バッジ・掲示板ログを一気に処理する
  await approveQuestInstance(updatedQuest as any, stamp ?? undefined);

  rlog.info("Parent reported-approved on behalf of child", {
    questId: id,
    childId: child.id,
    parentId: parent.id,
  });
  return NextResponse.json({ ok: true });
}
