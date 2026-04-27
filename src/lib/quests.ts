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
