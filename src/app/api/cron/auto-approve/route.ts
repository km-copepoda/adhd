import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { approveQuestInstance, approveSkipQuestInstance } from "@/lib/approve";
import { todayJST } from "@/lib/date";

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = todayJST();

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
          side: true,
          evolutionStage: true,
          studyPt: true,
          staminaPt: true,
          lifePt: true,
        },
      },
    },
  });

  let approved = 0;
  let skipped = 0;

  for (const quest of pendingQuests) {
    if (quest.status === "SKIP_REPORTED") {
      await approveSkipQuestInstance(quest);
      skipped++;
    } else {
      await approveQuestInstance(quest as any);
      approved++;
    }
  }

  return NextResponse.json({ ok: true, approved, skipped });
}
