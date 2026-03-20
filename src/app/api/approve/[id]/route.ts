import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { XP_MAP, checkEvolution } from "@/lib/constants";
import { recordDailyAchievement, recordTaskStreak } from "@/lib/streak";
import { routeLogger } from "@/lib/logger";
import type { Side } from "@/types";

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
  const { action, rejectionReason, rejectionComment } = await request.json();

  const quest = await prisma.questInstance.findUnique({
    where: { id },
    include: { template: true, child: true },
  });
  if (!quest) {
    rlog.warn("Quest not found", {questId: id, userId: user.id });
    return NextResponse.json({ error: "クエストが見つかりません" }, { status: 404 });
  }

  // スキップ申請の処理
  if (quest.status === "SKIP_REPORTED") {
    if (action === "reject") {
      // 差し戻し: PENDINGに戻す（コメントもクリア）
      await prisma.questInstance.update({
        where: { id },
        data: { status: "PENDING", comment: null },
      });
      rlog.info("Skip rejected, reset to PENDING", { questId: id, childId: quest.childId });
    } else {
      // スキップ承認: SKIPPEDに確定（XP付与なし、ストリーク記録あり）
      await prisma.questInstance.update({
        where: { id },
        data: { status: "SKIPPED", approvedAt: new Date() },
      });
      await recordDailyAchievement(quest.childId, quest.date);
      rlog.info("Skip approved", { questId: id, childId: quest.childId });
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "reject") {
    // rejectionReason は必須
    if (!rejectionReason) {
      return NextResponse.json({ error: "差し戻し理由を選択してください" }, { status: 400 });
    }
    // 「その他」の場合は追加メッセージ必須
    if (rejectionReason === "その他" && !rejectionComment?.trim()) {
      return NextResponse.json({ error: "「その他」の場合は追加メッセージを入力してください" }, { status: 400 });
    }

    // 差し戻し: ポイントは承認時付与のため、ステータス変更のみ
    // 「その他」の場合は rejectionComment を実際の理由として保存
    const reason = rejectionReason === "その他" ? rejectionComment!.trim() : rejectionReason;
    await prisma.questInstance.update({
      where: { id },
      data: { status: "REJECTED", rejectionReason: reason },
    });

    rlog.info("Quest rejected", { questId: id, childId: quest.childId, reason });
    return NextResponse.json({ ok: true });
  }

  // 通常承認: ポイント付与 + 進化チェック
  const xp = XP_MAP[quest.template.difficulty];
  const category = quest.template.category;
  const child = quest.child;

  const newStudy = child.studyPt + (category === "STUDY" ? xp : 0);
  const newStamina = child.staminaPt + (category === "STAMINA" ? xp : 0);
  const newLife = child.lifePt + (category === "LIFE" ? xp : 0);

  const evolution = checkEvolution(
    (child.side || "LIGHT") as Side,
    child.evolutionStage,
    newStudy,
    newStamina,
    newLife,
  );

  await prisma.questInstance.update({
    where: { id },
    data: { status: "APPROVED", approvedAt: new Date() },
  });

  await prisma.user.update({
    where: { id: quest.childId },
    data: {
      studyPt: evolution.resetStudy,
      staminaPt: evolution.resetStamina,
      lifePt: evolution.resetLife,
      evolutionStage: evolution.newStage,
    },
  });

  // 仮タスクのクエストを承認した場合、テンプレートも同時に承認する
  if (quest.template.createdBy === "CHILD") {
    await prisma.taskTemplate.update({
      where: { id: quest.templateId },
      data: { createdBy: "PARENT" },
    });
    rlog.info("Child template promoted to PARENT", { templateId: quest.templateId });
  }

  // ストリーク記録（その日初のAPPROVEDならストリーク更新）
  await recordDailyAchievement(quest.childId, quest.date);
  // タスク別ストリーク記録（一時タスクは対象外）
  if (!quest.template.isTemporary) {
    await recordTaskStreak(quest.templateId, quest.childId, quest.date);
  }

  rlog.done("Quest approved", {
    questId: id,
    childId: quest.childId,
    xp,
    category,
    evolved: evolution.evolved,
    newStage: evolution.newStage,
  });
  return NextResponse.json({ ok: true });
}
