import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { todayJST } from "@/lib/date";
import { ensureTodayQuests } from "@/lib/quests";
import {
  getIdleCalendarDays,
  getMissedExposureCount,
  groupRecentInstancesByTemplate,
  isEligibleForDeclaration,
} from "@/lib/declaration";

// 連鎖判定に使う lookback 件数（週次 30 週分）
const INSTANCE_LOOKBACK_LIMIT = 30;

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !user.familyId) {
    return NextResponse.json([]);
  }

  const today = todayJST();

  await ensureTodayQuests({ childId: user.id, familyId: user.familyId });

  // 今日のクエスト + carryOver の過去 PENDING を一括取得
  const quests = await prisma.questInstance.findMany({
    where: {
      childId: user.id,
      OR: [
        { date: today, template: { isActive: true, pausedAt: null } },
        { status: "PENDING", template: { isActive: true, pausedAt: null, carryOver: true } },
      ],
    },
    include: {
      template: {
        select: {
          id: true,
          title: true,
          emoji: true,
          category: true,
          isTemporary: true,
          createdBy: true,
          photoBonus: true,
          carryOver: true,
          createdAt: true,
          taskStreaks: {
            where: { childId: user.id },
            select: { currentStreak: true, bestStreak: true },
          },
        },
      },
    },
    orderBy: { template: { createdAt: "asc" } },
  });

  // 「今日やる宣言」用の集計: 各テンプレートの直近 N インスタンス + 当日宣言の有無
  const templateIds = Array.from(new Set(quests.map((q) => q.templateId)));
  // 履歴は全テンプレート分を1クエリで取得し、テンプレートごとの直近 N 件へ絞る
  // （取得行数は増えるがクエリ本数は定数。N+1 回避）
  const [historyRows, declarationsToday] = await Promise.all([
    templateIds.length
      ? prisma.questInstance.findMany({
          where: { childId: user.id, templateId: { in: templateIds } },
          orderBy: { date: "desc" },
          select: { templateId: true, date: true, status: true, approvedAt: true },
        })
      : Promise.resolve(
          [] as { templateId: string; date: Date; status: string; approvedAt: Date | null }[],
        ),
    templateIds.length
      ? prisma.questDeclaration.findMany({
          where: { childId: user.id, date: today, templateId: { in: templateIds } },
          select: { templateId: true },
        })
      : Promise.resolve([] as { templateId: string }[]),
  ]);

  const instancesMap = groupRecentInstancesByTemplate(
    historyRows,
    templateIds,
    INSTANCE_LOOKBACK_LIMIT,
  );
  const declaredTemplateIds = new Set(declarationsToday.map((d) => d.templateId));

  const hasDeadline = !!user.reportDeadlineTime;
  return NextResponse.json(
    quests.map((q) => {
      const allInstances = (instancesMap.get(q.templateId) ?? []).map((i) => ({
        date: i.date,
        status: i.status as
          | "PENDING"
          | "REPORTED"
          | "APPROVED"
          | "REJECTED"
          | "SKIPPED"
          | "SKIP_REPORTED",
      }));
      const lastApprovedAt =
        instancesMap.get(q.templateId)?.find((i) => i.status === "APPROVED")?.approvedAt ?? null;
      const idleDays = getIdleCalendarDays({
        today,
        lastApprovedAt,
        templateCreatedAt: q.template.createdAt,
      });
      const missedExposures = getMissedExposureCount({
        allInstances,
        today,
        carryOver: !!q.template.carryOver,
      });
      const eligibleForDeclaration = isEligibleForDeclaration({
        missedExposures,
        status: q.status,
      });
      return {
        ...q,
        hasDeadline,
        idleDays,
        eligibleForDeclaration,
        declaredToday: declaredTemplateIds.has(q.templateId),
        template: {
          ...q.template,
          title: q.snapshotTitle ?? q.template.title,
          emoji: q.snapshotEmoji ?? q.template.emoji,
          category: q.snapshotCategory ?? q.template.category,
        },
      };
    }),
  );
}
