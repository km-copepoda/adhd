import { prisma } from "@/lib/prisma";
import { todayJST, countScheduledOccurrences } from "@/lib/date";
import { ensureTodayQuests } from "@/lib/quests";

type QuestRow = { templateId: string; date: Date | null };

/**
 * carryOver タスクの「過去から持ち越し中の最古 PENDING 日付」を計算する。
 *
 * 直近の APPROVED/SKIPPED より古い PENDING は stale として無視する
 * （carryOver を後から ON にした等で、完了済みより古い PENDING が DB に残っているケース）。
 *
 * 入力前提:
 *   - `carryOverPending` は date 昇順
 *   - `settled` は date 降順
 */
export function computeOldestPendingDates(
  carryOverPending: QuestRow[],
  settled: QuestRow[],
): Map<string, Date> {
  const latestSettledMap = new Map<string, Date>();
  for (const q of settled) {
    if (!latestSettledMap.has(q.templateId) && q.date) {
      latestSettledMap.set(q.templateId, q.date);
    }
  }
  const oldestPendingMap = new Map<string, Date>();
  for (const q of carryOverPending) {
    if (!q.date) continue;
    const s = latestSettledMap.get(q.templateId);
    if (s && q.date <= s) continue;
    if (!oldestPendingMap.has(q.templateId)) {
      oldestPendingMap.set(q.templateId, q.date);
    }
  }
  return oldestPendingMap;
}

/**
 * 親画面タスクカードの「⏭ N日前スキップ」バッジ表示用に、
 * 「以降に APPROVED が無い」最新の SKIPPED 日付を templateId 別に返す。
 *
 * SKIPPED より後に APPROVED が記録された template はバッジを出さない
 * （その後ちゃんと完了しているので、スキップ事実だけが残り続けるのを防ぐ）。
 *
 * 入力前提:
 *   - `skipped` / `approved` は date 降順（先頭が最新）
 *   - 複数 children が同じ template を共有する場合も templateId 単位で集約する
 */
export function computeLastSkippedDates(
  skipped: QuestRow[],
  approved: QuestRow[],
): Map<string, Date> {
  const latestApprovedMap = new Map<string, Date>();
  for (const q of approved) {
    if (!q.date) continue;
    if (!latestApprovedMap.has(q.templateId)) {
      latestApprovedMap.set(q.templateId, q.date);
    }
  }
  const out = new Map<string, Date>();
  for (const q of skipped) {
    if (!q.date) continue;
    if (out.has(q.templateId)) continue;
    const approvedAt = latestApprovedMap.get(q.templateId);
    // approvedAt > skippedAt なら「その後完了済み」とみなしてバッジを消す。
    // 同日 (==) は DB unique 制約で起きないが、起きた場合は防御的にバッジを残す。
    if (approvedAt && approvedAt > q.date) continue;
    out.set(q.templateId, q.date);
  }
  return out;
}

/**
 * carryOver タスクの「N回未完了」を計算する。
 *
 * 最古 PENDING の日付から today までの inclusive 範囲で、repeatDays に当たる出現回数。
 * isTemporary 等で repeatDays が空の場合は出現が1度しか定義されないので1にフォールバック。
 */
export function calcCarryOverMissedCount(
  oldestPendingDate: Date | null | undefined,
  today: Date,
  repeatDays: number[],
): number | null {
  if (!oldestPendingDate) return null;
  if (repeatDays.length === 0) return 1;
  return countScheduledOccurrences(oldestPendingDate, today, repeatDays);
}

/**
 * 親画面用のタスク一覧サマリーを構築する。
 *
 * - 子供画面が一度も開かれていなくても今日分のクエストを materialize（carryOver の動作保証のため）
 * - 各タスクに当日の完了状態、直近7日間の最終 SKIPPED 日、carryOver 累積回数を付与する
 */
export async function getParentTaskSummaries(familyId: string) {
  const children = await prisma.user.findMany({
    where: { familyId, role: "CHILD" },
    select: { id: true },
  });
  await Promise.all(
    children.map((c) => ensureTodayQuests({ childId: c.id, familyId })),
  );

  const tasks = await prisma.taskTemplate.findMany({
    where: { familyId, isActive: true },
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

  // 直近7日間のSKIPPEDを取得（該当曜日でない日にも親がスキップに気づけるよう、タスクカードにバッジ表示するため）。
  // ただし、その後に APPROVED が記録されていれば「完了済みなのにスキップだけ残る」UX を避けるためバッジを消す。
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
  // SKIPPED の最古日付以降に APPROVED があるかだけ確認できればよいので、同じ 7 日窓で取得する。
  // 窓外（8日以上前）の APPROVED は窓外の SKIPPED に対するもので、本ロジックの判定対象外。
  const recentApproved = await prisma.questInstance.findMany({
    where: {
      templateId: { in: taskIds },
      status: "APPROVED",
      date: { gte: sevenDaysAgo, lte: today },
    },
    select: { templateId: true, date: true },
    orderBy: { date: "desc" },
  });
  const lastSkippedMap = computeLastSkippedDates(recentSkipped, recentApproved);

  const carryOverTaskIds = tasks
    .filter((t) => (t as { carryOver?: boolean }).carryOver)
    .map((t) => t.id);
  let oldestPendingMap = new Map<string, Date>();
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
    const latestSettled = await prisma.questInstance.findMany({
      where: {
        templateId: { in: carryOverTaskIds },
        status: { in: ["APPROVED", "SKIPPED"] },
      },
      select: { templateId: true, date: true },
      orderBy: { date: "desc" },
    });
    oldestPendingMap = computeOldestPendingDates(carryOverPending, latestSettled);
  }

  return tasks.map((t) => {
    const oldest = oldestPendingMap.get(t.id);
    const repeatDays = (t as { repeatDays?: number[] }).repeatDays ?? [];
    return {
      ...t,
      completedToday: completedSet.has(t.id),
      lastSkippedDate: lastSkippedMap.get(t.id) ?? null,
      carryOverMissedCount: calcCarryOverMissedCount(oldest, today, repeatDays),
    };
  });
}
