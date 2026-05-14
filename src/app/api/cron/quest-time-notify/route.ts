import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPushToChild } from "@/lib/push";
import { todayJST } from "@/lib/date";
import { computeCompletedCount } from "@/lib/questProgress";
import { buildQuestTimeNotification } from "@/lib/notifyMessages";
import { routeLogger } from "@/lib/logger";

export async function GET(request: Request) {
  const rlog = routeLogger("GET", "/api/cron/quest-time-notify");
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    rlog.warn("Unauthorized cron request");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = todayJST();
  rlog.info("Quest-time notify cron started", { today: today.toISOString() });

  const children = await prisma.user.findMany({
    where: {
      role: "CHILD",
      questTimeNotifyEnabled: true,
    },
    select: { id: true },
  });

  let notified = 0;
  let skipped = 0;

  for (const child of children) {
    const quests = await prisma.questInstance.findMany({
      where: { childId: child.id, date: today },
      select: { status: true },
    });

    const done = computeCompletedCount(quests);
    const payload = buildQuestTimeNotification({
      done,
      total: quests.length,
    });

    if (!payload) {
      skipped++;
      continue;
    }

    await sendPushToChild(child.id, {
      title: payload.title,
      body: payload.body,
      url: "/app/child/quests",
    });
    notified++;
  }

  rlog.done("Quest-time notify cron completed", { notified, skipped });
  return NextResponse.json({ ok: true, notified, skipped });
}
