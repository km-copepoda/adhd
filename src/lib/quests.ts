import { prisma } from "@/lib/prisma";
import { todayJST, dayOfWeekJST } from "@/lib/date";

/**
 * carryOver=true のテンプレートで「直近 APPROVED/SKIPPED より古い未処理クエスト」を REJECTED に降格する。
 *
 * carryOver を後から ON にした際、過去の生き残り PENDING/REPORTED が
 * 「未完了の持ち越し」として再浮上してしまうバグの遅延クリーンアップ。
 */
export async function cleanupStaleCarryOverInstances(params: {
  childId: string;
  templates: Array<{ id: string; carryOver?: boolean }>;
}): Promise<void> {
  const { childId, templates } = params;
  const carryOverIds = templates.filter((t) => t.carryOver).map((t) => t.id);
  if (carryOverIds.length === 0) return;

  const settled = await prisma.questInstance.findMany({
    where: {
      templateId: { in: carryOverIds },
      childId,
      status: { in: ["APPROVED", "SKIPPED"] },
    },
    select: { templateId: true, date: true },
    orderBy: { date: "desc" },
  });

  const latestSettledMap = new Map<string, Date>();
  for (const q of settled) {
    if (!q.date) continue;
    if (!latestSettledMap.has(q.templateId)) {
      latestSettledMap.set(q.templateId, q.date);
    }
  }

  for (const [templateId, latestDate] of latestSettledMap) {
    await prisma.questInstance.updateMany({
      where: {
        templateId,
        childId,
        status: { in: ["PENDING", "REPORTED", "SKIP_REPORTED"] },
        date: { lt: latestDate },
      },
      data: {
        status: "REJECTED",
        rejectionReason: "STALE_CARRYOVER_CLEANUP",
      },
    });
  }

  // 重複アクティブの縮約: 同じテンプレートに PENDING/REPORTED/SKIP_REPORTED が
  // 複数あれば 1 つだけ残して他を REJECTED にする。
  // 残す優先順:
  //   1. REPORTED（親の承認待ち。最優先で残す）
  //   2. SKIP_REPORTED（スキップ承認待ち）
  //   3. 最新 PENDING（最古ではなく最新を残す。最古を残すと「今日の重複 PENDING」が
  //      REJECTED 状態で `date: today` の今日リストに居残り、子画面に
  //      "DUPLICATE_PENDING_CLEANUP" 文字列が露出するため）
  for (const templateId of carryOverIds) {
    const actives = await prisma.questInstance.findMany({
      where: {
        templateId,
        childId,
        status: { in: ["PENDING", "REPORTED", "SKIP_REPORTED"] },
      },
      select: { id: true, date: true, status: true },
      orderBy: { date: "asc" },
    });

    if (actives.length <= 1) continue;

    const reported = actives.find((a) => a.status === "REPORTED");
    const skipReported = actives.find((a) => a.status === "SKIP_REPORTED");
    const newestPending = [...actives].reverse().find((a) => a.status === "PENDING");
    const keepId = (reported ?? skipReported ?? newestPending ?? actives[actives.length - 1]).id;
    const rejectIds = actives.filter((a) => a.id !== keepId).map((a) => a.id);

    await prisma.questInstance.updateMany({
      where: { id: { in: rejectIds } },
      data: {
        status: "REJECTED",
        rejectionReason: "DUPLICATE_PENDING_CLEANUP",
      },
    });
  }
}

/**
 * 指定した子供の「今日」の QuestInstance を materialize する。
 *
 * - 通常タスク: 今日の曜日に該当する repeatDays を持つテンプレートを upsert
 * - 一時タスク: targetDate が今日のものを upsert
 * - carryOver=true のタスク: 既存 PENDING があれば upsert をスキップ（1インスタンス保証）
 *
 * 子供が画面を開かなくても親画面からも呼べるように切り出した共有ロジック。
 */
export async function ensureTodayQuests(params: {
  childId: string;
  familyId: string;
}): Promise<void> {
  const { childId, familyId } = params;
  const today = todayJST();
  const dayOfWeek = dayOfWeekJST();

  const templates = await prisma.taskTemplate.findMany({
    where: {
      familyId,
      assignedChildId: childId,
      isActive: true,
      OR: [
        // 承認済み通常タスク: 今日の曜日に対応
        { isTemporary: false, createdBy: "PARENT", repeatDays: { has: dayOfWeek } },
        // 未承認の子供タスク: 申請日（requestedDate）が今日かつ今日の曜日に対応
        { isTemporary: false, createdBy: "CHILD", requestedDate: today, repeatDays: { has: dayOfWeek } },
        // 一時タスク: targetDate が今日
        { isTemporary: true, targetDate: today },
      ],
    },
  });

  if (templates.length === 0) return;

  // carryOver タスクの stale データを先にクリーンアップしてから 1 インスタンス保証ロジックに進む
  await cleanupStaleCarryOverInstances({ childId, templates });

  // carryOver タスクは既存 PENDING がある場合 upsert をスキップ（1インスタンス保証）
  const carryOverTemplates = templates.filter((t) => (t as any).carryOver);
  const normalTemplates = templates.filter((t) => !(t as any).carryOver);

  const carryOverChecks = await Promise.all(
    carryOverTemplates.map(async (template) => {
      const existing = await prisma.questInstance.findFirst({
        where: { templateId: template.id, childId, status: "PENDING" },
      });
      return { template, hasPending: !!existing };
    })
  );

  const templatesToUpsert = [
    ...normalTemplates,
    ...carryOverChecks.filter((c) => !c.hasPending).map((c) => c.template),
  ];

  await Promise.all(
    templatesToUpsert.map((template) =>
      prisma.questInstance.upsert({
        where: {
          templateId_childId_date: {
            templateId: template.id,
            childId,
            date: today,
          },
        },
        update: {},
        create: {
          templateId: template.id,
          childId,
          date: today,
          snapshotTitle: template.title,
          snapshotEmoji: template.emoji,
          snapshotCategory: template.category,
        },
      })
    )
  );
}
