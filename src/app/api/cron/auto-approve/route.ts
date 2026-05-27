import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { approveQuestInstance, approveSkipQuestInstance } from "@/lib/approve";
import { todayJST } from "@/lib/date";
import { routeLogger } from "@/lib/logger";
import { computeCompletedCount } from "@/lib/questProgress";
import { generateAutoApproveTreasure } from "@/lib/treasureService";

export async function GET(request: Request) {
  const rlog = routeLogger("GET", "/api/cron/auto-approve");
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    rlog.warn("Unauthorized cron request");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = todayJST();
  rlog.info("Auto-approve cron started", { today: today.toISOString() });

  // 前日以前に報告されたまま未承認のクエストを全取得
  const pendingQuests = await prisma.questInstance.findMany({
    where: {
      date: { lt: today },
      status: { in: ["REPORTED", "SKIP_REPORTED"] },
    },
    include: {
      template: {
        select: {
          id: true,
          category: true,
          createdBy: true,
          isTemporary: true,
          photoBonus: true,
          repeatDays: true,
        },
      },
      child: {
        select: {
          id: true,
          evolutionStage: true,
          evolutionPath: true,
          collectedPaths: true,
          studyPt: true,
          staminaPt: true,
          lifePt: true,
        },
      },
    },
  });

  rlog.info("Pending quests fetched", { total: pendingQuests.length });
  let approved = 0;
  let skipped = 0;

  // (childId, date) ごとにグルーピング — AUTO 宝箱は1日1個（仕様 4 章）
  const groups = new Map<
    string,
    { childId: string; date: Date; minTasks: number }
  >();
  for (const quest of pendingQuests) {
    const key = `${quest.childId}|${quest.date.toISOString()}`;
    if (!groups.has(key)) {
      const child = quest.child as unknown as { minTasksForStreak?: number };
      groups.set(key, {
        childId: quest.childId,
        date: quest.date,
        minTasks: child.minTasksForStreak ?? 1,
      });
    }
  }

  for (const quest of pendingQuests) {
    if (quest.status === "SKIP_REPORTED") {
      await approveSkipQuestInstance(quest);
      skipped++;
    } else {
      await approveQuestInstance(quest);
      approved++;
    }
  }

  // 自動承認の AUTO 宝箱生成（即 UNLOCKED）
  let autoTreasures = 0;
  for (const group of groups.values()) {
    const todayQuests = await prisma.questInstance.findMany({
      where: { childId: group.childId, date: group.date },
      select: { status: true },
    });
    const treasureId = await generateAutoApproveTreasure({
      childId: group.childId,
      date: group.date,
      reportedCount: computeCompletedCount(todayQuests),
      totalCount: todayQuests.length,
      minTasks: group.minTasks,
    });
    if (treasureId) autoTreasures++;
  }

  rlog.done("Auto-approve cron completed", { approved, skipped, autoTreasures });
  return NextResponse.json({ ok: true, approved, skipped, autoTreasures });
}
