import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { routeLogger } from "@/lib/logger";

/** PATCH /api/family/settings — ファミリー設定更新（親のみ）*/
export async function PATCH(request: Request) {
  const rlog = routeLogger("PATCH", "/api/family/settings");
  const user = await getCurrentUser();
  if (!user || user.role !== "PARENT" || !user.familyId) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const body = await request.json();

  // reportDeadlineTime: "HH:mm" 形式 or null
  if ("reportDeadlineTime" in body) {
    const value: string | null = body.reportDeadlineTime;
    if (value !== null && !/^\d{2}:\d{2}$/.test(value)) {
      return NextResponse.json({ error: "reportDeadlineTime は HH:mm 形式で指定してください" }, { status: 400 });
    }

    await prisma.family.update({
      where: { id: user.familyId },
      data: { reportDeadlineTime: value },
    });

    rlog.info("Family reportDeadlineTime updated", { familyId: user.familyId, value });
  }

  return NextResponse.json({ ok: true });
}
