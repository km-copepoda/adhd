import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { approveQuestInstance, approveSkipQuestInstance } from "@/lib/approve";
import { todayJST } from "@/lib/date";
import { routeLogger } from "@/lib/logger";

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

  for (const quest of pendingQuests) {
    if (quest.status === "SKIP_REPORTED") {
      await approveSkipQuestInstance(quest);
      skipped++;
    } else {
      await approveQuestInstance(quest);
      approved++;
    }
  }

  rlog.done("Auto-approve cron completed", { approved, skipped });
  return NextResponse.json({ ok: true, approved, skipped });
}
