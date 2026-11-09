import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { routeLogger } from "@/lib/logger";
import { isValidCheckinDeadlineTime } from "@/lib/checkin.logic";

/** "HH:mm"（00:00〜23:59）の文字列 or null（解除）か */
function isValidTimeOrNull(value: unknown): value is string | null {
  return value === null || (typeof value === "string" && isValidCheckinDeadlineTime(value));
}

/** PATCH /api/family/settings — ファミリー設定更新（親のみ）*/
export async function PATCH(request: Request) {
  const rlog = routeLogger("PATCH", "/api/family/settings");
  const user = await getCurrentUser();
  if (!user || user.role !== "PARENT" || !user.familyId) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const body = await request.json();
  const childId: unknown = body?.childId;
  if (typeof childId !== "string" || !childId) {
    return NextResponse.json({ error: "childId を指定してください" }, { status: 400 });
  }

  // 先に全フィールドを検証し、1 つでも不正なら何も更新しない（部分適用の防止）
  const data: {
    reportDeadlineTime?: string | null;
    checkinDeadlineTime?: string | null;
    questTimeNotifyEnabled?: boolean;
    rubyEnabled?: boolean;
  } = {};

  // reportDeadlineTime / checkinDeadlineTime: "HH:mm" 形式 or null で設定（子供単位）
  if ("reportDeadlineTime" in body) {
    if (!isValidTimeOrNull(body.reportDeadlineTime)) {
      return NextResponse.json({ error: "reportDeadlineTime は HH:mm 形式で指定してください" }, { status: 400 });
    }
    data.reportDeadlineTime = body.reportDeadlineTime;
  }
  if ("checkinDeadlineTime" in body) {
    if (!isValidTimeOrNull(body.checkinDeadlineTime)) {
      return NextResponse.json(
        { error: "checkinDeadlineTime は HH:mm 形式で指定してください" },
        { status: 400 },
      );
    }
    data.checkinDeadlineTime = body.checkinDeadlineTime;
  }

  // questTimeNotifyEnabled / rubyEnabled: boolean（子供単位）
  if ("questTimeNotifyEnabled" in body) {
    if (typeof body.questTimeNotifyEnabled !== "boolean") {
      return NextResponse.json(
        { error: "questTimeNotifyEnabled は boolean で指定してください" },
        { status: 400 },
      );
    }
    data.questTimeNotifyEnabled = body.questTimeNotifyEnabled;
  }
  if ("rubyEnabled" in body) {
    if (typeof body.rubyEnabled !== "boolean") {
      return NextResponse.json({ error: "rubyEnabled は boolean で指定してください" }, { status: 400 });
    }
    data.rubyEnabled = body.rubyEnabled;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "更新する項目がありません" }, { status: 400 });
  }

  // 対象の子供が同じファミリーに属しているか確認
  const child = await prisma.user.findFirst({
    where: { id: childId, familyId: user.familyId, role: "CHILD" },
    select: { id: true },
  });
  if (!child) {
    return NextResponse.json({ error: "対象の子供が見つかりません" }, { status: 404 });
  }

  await prisma.user.update({ where: { id: childId }, data });

  rlog.info("Child settings updated", { childId, fields: Object.keys(data) });
  return NextResponse.json({ ok: true });
}
