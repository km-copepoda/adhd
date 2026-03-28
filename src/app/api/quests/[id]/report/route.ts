import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { isBeforeDeadline } from "@/lib/date";
import { sendPushToParent } from "@/lib/push";
import { routeLogger } from "@/lib/logger";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const rlog = routeLogger("POST", "/api/quests/[id]/report");
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { id } = await params;
  const { comment, photoUrl } = await request.json();

  const [quest, family] = await Promise.all([
    prisma.questInstance.findUnique({
      where: { id, childId: user.id },
      include: { template: true },
    }),
    user.familyId
      ? prisma.family.findUnique({
          where: { id: user.familyId },
          select: { reportDeadlineTime: true },
        })
      : null,
  ]);

  if (!quest) {
    return NextResponse.json({ error: "クエストが見つかりません" }, { status: 404 });
  }

  const now = new Date();

  // 期限ボーナス: 初回報告（PENDING→REPORTED）時のみ判定・設定
  let deadlineBonusEarned: boolean | undefined;
  if (quest.status === "PENDING") {
    const deadlineTime = family?.reportDeadlineTime ?? null;
    deadlineBonusEarned = deadlineTime
      ? isBeforeDeadline(now, quest.date, deadlineTime)
      : false;
  }
  // 差し戻し後の再報告（REJECTED→REPORTED）では deadlineBonusEarned を変更しない

  // プレビューXP計算（承認時に確定するが、報告時に暫定表示用）
  const effectiveDeadlineBonus = deadlineBonusEarned ?? quest.deadlineBonusEarned;
  const category = quest.template.category;
  let xp = 1;
  if (effectiveDeadlineBonus) xp++;
  if (quest.template.photoBonus && photoUrl) xp++;

  // ステータス更新。再報告時は差し戻し理由をクリア。deadlineBonusEarned は初回のみ設定
  await prisma.questInstance.update({
    where: { id },
    data: {
      status: "REPORTED",
      comment,
      photoUrl: photoUrl ?? null,
      reportedAt: now,
      rejectionReason: null,
      ...(deadlineBonusEarned !== undefined ? { deadlineBonusEarned } : {}),
    },
  });

  // 親に通知
  if (user.familyId) {
    const parent = await prisma.user.findFirst({
      where: { familyId: user.familyId, role: "PARENT" },
    });
    if (parent) {
      const childName = user.monsterName ?? user.name ?? "子供";
      await sendPushToParent(parent.id, {
        title: "✅ クエスト報告",
        body: `${childName}が「${quest.template.title}」を完了しました`,
        url: "/parent/approve",
      });
    }
  }

  rlog.info("Quest reported", { questId: id, childId: user.id, xp, category });
  return NextResponse.json({ ok: true, xpAdded: xp, category });
}
