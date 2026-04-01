import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { approveQuestInstance, approveSkipQuestInstance } from "@/lib/approve";
import { routeLogger } from "@/lib/logger";

export async function POST(request: Request) {
  const rlog = routeLogger("POST", "/api/approve/bulk");
  const user = await getCurrentUser();
  if (!user || user.role !== "PARENT") {
    rlog.warn("Unauthorized bulk approve attempt", { userId: user?.id });
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const { ids } = await request.json() as { ids: string[] };
  rlog.info("Bulk approve started", { userId: user.id, total: ids.length });
  let count = 0;

  // 並列処理するとXPのread-modify-writeがレース状態になるため、順次処理する
  for (const id of ids) {
    const quest = await prisma.questInstance.findUnique({
      where: { id },
      include: { template: true, child: true },
    });
    if (!quest) continue;

    if (quest.status === "SKIP_REPORTED") {
      await approveSkipQuestInstance(quest);
    } else if (quest.status === "REPORTED") {
      await approveQuestInstance(quest);
    } else {
      continue;
    }
    count++;
  }

  rlog.done("Bulk approve completed", { userId: user.id, approved: count });
  return NextResponse.json({ ok: true, count });
}
