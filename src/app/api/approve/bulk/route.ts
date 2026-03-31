import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { approveQuestInstance, approveSkipQuestInstance } from "@/lib/approve";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "PARENT") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const { ids } = await request.json() as { ids: string[] };
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

  return NextResponse.json({ ok: true, count });
}
