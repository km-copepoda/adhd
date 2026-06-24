import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { routeLogger } from "@/lib/logger";
import { isValidCheckinDeadlineTime } from "@/lib/checkin.logic";

/** PATCH /api/family/settings — ファミリー設定更新（親のみ）*/
export async function PATCH(request: Request) {
  const rlog = routeLogger("PATCH", "/api/family/settings");
  const user = await getCurrentUser();
  if (!user || user.role !== "PARENT" || !user.familyId) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const body = await request.json();

  // reportDeadlineTime: childId で対象の子供を指定し、"HH:mm" 形式 or null で設定
  if ("reportDeadlineTime" in body && "childId" in body) {
    const value: string | null = body.reportDeadlineTime;
    const childId: string = body.childId;

    if (value !== null && !/^\d{2}:\d{2}$/.test(value)) {
      return NextResponse.json({ error: "reportDeadlineTime は HH:mm 形式で指定してください" }, { status: 400 });
    }

    // 対象の子供が同じファミリーに属しているか確認
    const child = await prisma.user.findFirst({
      where: { id: childId, familyId: user.familyId, role: "CHILD" },
      select: { id: true },
    });
    if (!child) {
      return NextResponse.json({ error: "対象の子供が見つかりません" }, { status: 404 });
    }

    await prisma.user.update({
      where: { id: childId },
      data: { reportDeadlineTime: value },
    });

    rlog.info("Child reportDeadlineTime updated", { childId, value });
  }

  // checkinDeadlineTime: チェックインカレンダーの締切時刻（子供単位、"HH:mm" or null）
  if ("checkinDeadlineTime" in body && "childId" in body) {
    const value: string | null = body.checkinDeadlineTime;
    const childId: string = body.childId;

    if (value !== null && !isValidCheckinDeadlineTime(value)) {
      return NextResponse.json(
        { error: "checkinDeadlineTime は HH:mm 形式で指定してください" },
        { status: 400 },
      );
    }

    const child = await prisma.user.findFirst({
      where: { id: childId, familyId: user.familyId, role: "CHILD" },
      select: { id: true },
    });
    if (!child) {
      return NextResponse.json({ error: "対象の子供が見つかりません" }, { status: 404 });
    }

    await prisma.user.update({
      where: { id: childId },
      data: { checkinDeadlineTime: value },
    });

    rlog.info("Child checkinDeadlineTime updated", { childId, value });
  }

  // questTimeNotifyEnabled: クエストタイム自動通知の ON/OFF（子供単位）
  if ("questTimeNotifyEnabled" in body && "childId" in body) {
    const value = body.questTimeNotifyEnabled;
    const childId: string = body.childId;

    if (typeof value !== "boolean") {
      return NextResponse.json(
        { error: "questTimeNotifyEnabled は boolean で指定してください" },
        { status: 400 },
      );
    }

    const child = await prisma.user.findFirst({
      where: { id: childId, familyId: user.familyId, role: "CHILD" },
      select: { id: true },
    });
    if (!child) {
      return NextResponse.json({ error: "対象の子供が見つかりません" }, { status: 404 });
    }

    await prisma.user.update({
      where: { id: childId },
      data: { questTimeNotifyEnabled: value },
    });

    rlog.info("Child questTimeNotifyEnabled updated", { childId, value });
  }

  return NextResponse.json({ ok: true });
}
