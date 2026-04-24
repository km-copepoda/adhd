import { prisma } from "@/lib/prisma";
import { todayJST, dayOfWeekJST } from "@/lib/date";

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
