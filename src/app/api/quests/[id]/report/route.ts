import { NextResponse, after } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { isBeforeDeadline, todayJST } from "@/lib/date";
import { sendPushToParent } from "@/lib/push";
import { routeLogger } from "@/lib/logger";
import { triggerTaskProgressLog } from "@/lib/bulletinLog";
import { computeCompletedCount, computeSkippedCount } from "@/lib/questProgress";
import { generateTreasuresOnReport } from "@/lib/treasureService";

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

  const quest = await prisma.questInstance.findUnique({
    where: { id, childId: user.id },
    include: { template: true },
  });

  if (!quest) {
    return NextResponse.json({ error: "クエストが見つかりません" }, { status: 404 });
  }

  const now = new Date();

  // 期限ボーナス: 初回報告（PENDING→REPORTED）時のみ判定・設定（子供単位の期限を参照）
  let deadlineBonusEarned: boolean | undefined;
  if (quest.status === "PENDING") {
    const deadlineTime = user.reportDeadlineTime ?? null;
    deadlineBonusEarned = deadlineTime
      ? isBeforeDeadline(now, quest.date, deadlineTime)
      : false;
  }
  // 差し戻し後の再報告（REJECTED→REPORTED）では deadlineBonusEarned を変更しない

  // プレビューXP計算（承認時に確定するが、報告時に暫定表示用）
  const effectiveDeadlineBonus = deadlineBonusEarned ?? quest.deadlineBonusEarned;
  const category = quest.snapshotCategory ?? quest.template.category;
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
      const questTitle = quest.snapshotTitle ?? quest.template.title;
      await sendPushToParent(parent.id, {
        title: "✅ クエスト報告",
        body: `${childName}が「${questTitle}」を完了しました`,
        url: "/app/parent/approve",
      });
    }
  }

  // 宝箱（ごほうび）生成: 当日の進捗状況を再集計して、LOCKED 宝箱を作る
  // この経路は子供本人の報告なので isProxy=false 固定（親代理は別ルート）
  //
  // carryOver タスクが古い日付（quest.date < today）で報告された場合、quest.date 基準で
  // 集計すると「その日付には他タスクが無い → totalCount=1 で全完了扱い → STREAK + boosted
  // ALL_COMPLETE が古日付で生成される」というバグになる。古日付 carryOver 報告は今日の
  // 行動として扱い、宝箱の date と集計も今日基準に切替える。carryOver 自身は別日付に
  // 紐づくため findMany には含まれず、別途 1件として加算する。
  const today = todayJST();
  const isCarryOverPastReport =
    !!quest.template?.carryOver && quest.date.getTime() < today.getTime();
  const aggregationDate = isCarryOverPastReport ? today : quest.date;
  // template.isActive / pausedAt でフィルタして「子供画面 (/api/quests/today) に映る
  // タスク集合」と揃える。親がテンプレを pause / 無効化した後もインスタンスは残るため、
  // フィルタしないと「見えない幽霊タスク」で totalCount が水増しされ ALL_COMPLETE が
  // 出ない体験になる。
  const sameDateQuests = await prisma.questInstance.findMany({
    where: {
      childId: user.id,
      date: aggregationDate,
      template: { isActive: true, pausedAt: null },
    },
    select: { status: true },
  });
  const aggregateQuests = isCarryOverPastReport
    ? [...sameDateQuests, { status: "REPORTED" as const }]
    : sameDateQuests;
  const reportedCount = computeCompletedCount(aggregateQuests);
  const skippedCount = computeSkippedCount(aggregateQuests);
  const totalCount = aggregateQuests.length;
  const treasureIds = await generateTreasuresOnReport({
    childId: user.id,
    date: aggregationDate,
    reportedCount,
    totalCount,
    skippedCount,
    minTasks: user.minTasksForStreak,
    isProxy: false,
  });

  // 掲示板ログ — レスポンス送信後に実行（サーバレスで取りこぼさないため after() を使う）
  after(() => triggerTaskProgressLog(user.id).catch(() => {}));

  rlog.info("Quest reported", { questId: id, childId: user.id, xp, category, treasureIds });
  return NextResponse.json({ ok: true, xpAdded: xp, category, treasureIds });
}
