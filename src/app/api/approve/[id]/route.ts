import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { approveQuestInstance, approveSkipQuestInstance } from "@/lib/approve";
import { routeLogger } from "@/lib/logger";
import { computeCompletedCount } from "@/lib/questProgress";
import { cancelTreasuresOnReject } from "@/lib/treasureService";

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
  const { action, rejectionReason, rejectionComment, stamp } = await request.json();

  const quest = await prisma.questInstance.findUnique({
    where: { id },
    include: { template: true, child: true },
  });
  if (!quest) {
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
    const todayQuests = await prisma.questInstance.findMany({
      where: { childId: quest.childId, date: quest.date },
      select: { status: true },
    });
    await cancelTreasuresOnReject({
      childId: quest.childId,
      date: quest.date,
      reportedCount: computeCompletedCount(todayQuests),
      totalCount: todayQuests.length,
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
