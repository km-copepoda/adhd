import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import {
  approveQuestInstance,
  approveSkipQuestInstance,
  approveTreasureUse,
  rejectTreasureUse,
} from "@/lib/approve";
import { canApproveUse, canRejectUse } from "@/lib/treasureUse";
import { routeLogger } from "@/lib/logger";
import { computeCompletedCount, computeSkippedCount } from "@/lib/questProgress";
import { cancelTreasuresOnReject } from "@/lib/treasureService";
import { resolveTreasureDate } from "@/lib/treasureDate";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const rlog = routeLogger("POST", "/api/approve/[id]");
  const user = await getCurrentUser();
  if (!user || user.role !== "PARENT") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const { id } = await params;
  const { kind, action, rejectionReason, rejectionComment, stamp } = await request.json();

  if (kind !== "quest" && kind !== "treasure_use") {
    return NextResponse.json({ error: "kind は quest または treasure_use を指定してください" }, { status: 400 });
  }

  if (kind === "treasure_use") {
    return handleTreasureUse(rlog, user, id, action);
  }

  const quest = await prisma.questInstance.findUnique({
    where: { id },
    include: { template: true, child: true },
  });
  if (!quest || quest.template.familyId !== user.familyId || quest.child.familyId !== user.familyId) {
    rlog.warn("Quest not found", { questId: id, userId: user.id });
    return NextResponse.json({ error: "クエストが見つかりません" }, { status: 404 });
  }

  // スキップ申請の処理
  if (quest.status === "SKIP_REPORTED") {
    if (action === "reject") {
      await prisma.questInstance.update({
        where: { id },
        data: { status: "PENDING", comment: null },
      });
      // スキップ却下で「対処済み」が 1 件減り、ALL_COMPLETE 等の LOCKED 宝箱の
      // 前提が崩れる可能性があるので再評価する。
      // - reportedCount が minTasks を割れば LOCKED 全部 CANCELLED
      // - 全完了でなくなれば ALL_COMPLETE のみ CANCELLED
      //   (再報告で生成し直されるので、最新の skippedCount に応じた boost で出る)
      // carryOver 過去日付は生成側 (report/skip) が使った基準日 (reportedAt) と揃える。
      const treasureDate = resolveTreasureDate(
        quest.date,
        quest.template.carryOver,
        quest.reportedAt ?? new Date(),
      );
      const todayQuests = await prisma.questInstance.findMany({
        where: {
          childId: quest.childId,
          date: treasureDate,
          template: { isActive: true, pausedAt: null },
        },
        select: { status: true },
      });
      await cancelTreasuresOnReject({
        childId: quest.childId,
        date: treasureDate,
        reportedCount: computeCompletedCount(todayQuests),
        totalCount: todayQuests.length,
        skippedCount: computeSkippedCount(todayQuests),
        minTasks: quest.child.minTasksForStreak,
        isProxy: false,
      });
      rlog.info("Skip rejected, reset to PENDING", { questId: id, childId: quest.childId });
    } else {
      await approveSkipQuestInstance(quest);
      rlog.info("Skip approved", { questId: id, childId: quest.childId });
    }
    return NextResponse.json({ ok: true });
  }

  // REPORTED 以外のステータスは操作不可（二重承認・未報告承認を防ぐ）
  if (quest.status !== "REPORTED") {
    rlog.warn("Invalid quest status for approval/rejection", { questId: id, status: quest.status });
    return NextResponse.json({ error: "このクエストは操作できません" }, { status: 400 });
  }

  if (action === "reject") {
    if (!rejectionReason) {
      return NextResponse.json({ error: "差し戻し理由を選択してください" }, { status: 400 });
    }
    if (rejectionReason === "その他" && !rejectionComment?.trim()) {
      return NextResponse.json({ error: "「その他」の場合は追加メッセージを入力してください" }, { status: 400 });
    }

    const reason = rejectionReason === "その他" ? rejectionComment!.trim() : rejectionReason;
    await prisma.questInstance.update({
      where: { id },
      data: { status: "REJECTED", rejectionReason: reason },
    });

    // 差し戻し後の当日進捗を集計して、条件を割った LOCKED 宝箱を CANCELLED に
    // carryOver 過去日付は生成側 (report/skip) が使った基準日 (reportedAt) と揃える。
    const treasureDate = resolveTreasureDate(
      quest.date,
      quest.template.carryOver,
      quest.reportedAt ?? new Date(),
    );
    const todayQuests = await prisma.questInstance.findMany({
      where: {
        childId: quest.childId,
        date: treasureDate,
        template: { isActive: true, pausedAt: null },
      },
      select: { status: true },
    });
    await cancelTreasuresOnReject({
      childId: quest.childId,
      date: treasureDate,
      reportedCount: computeCompletedCount(todayQuests),
      totalCount: todayQuests.length,
      skippedCount: computeSkippedCount(todayQuests),
      minTasks: quest.child.minTasksForStreak,
      isProxy: false,
    });

    rlog.info("Quest rejected", { questId: id, childId: quest.childId, reason });
    return NextResponse.json({ ok: true });
  }

  // 通常承認
  await approveQuestInstance(quest, stamp ?? undefined);

  rlog.done("Quest approved", {
    questId: id,
    childId: quest.childId,
    category: quest.template.category,
  });
  return NextResponse.json({ ok: true });
}

async function handleTreasureUse(
  rlog: ReturnType<typeof routeLogger>,
  user: { id: string; familyId: string | null },
  id: string,
  action: string,
) {
  const log = await prisma.treasureLog.findFirst({
    where: { id, child: { familyId: user.familyId } },
    select: { id: true, useStatus: true },
  });
  if (!log) {
    rlog.warn("Treasure use not found", { logId: id, userId: user.id });
    return NextResponse.json({ error: "対象が見つかりません" }, { status: 404 });
  }

  if (action === "reject") {
    if (!canRejectUse(log.useStatus)) {
      return NextResponse.json({ error: "この状態からは却下できません" }, { status: 400 });
    }
    const { count } = await rejectTreasureUse(id);
    if (count === 0) {
      return NextResponse.json({ error: "この状態からは却下できません" }, { status: 400 });
    }
    rlog.info("Treasure use rejected", { logId: id, parentId: user.id });
    return NextResponse.json({ ok: true });
  }

  if (!canApproveUse(log.useStatus)) {
    return NextResponse.json({ error: "この状態からは承認できません" }, { status: 400 });
  }
  const { count } = await approveTreasureUse(id);
  if (count === 0) {
    return NextResponse.json({ error: "この状態からは承認できません" }, { status: 400 });
  }
  rlog.info("Treasure use approved", { logId: id, parentId: user.id });
  return NextResponse.json({ ok: true });
}
