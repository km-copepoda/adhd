import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { isUniqueViolation } from "@/lib/prismaErrors";
import { routeLogger } from "@/lib/logger";

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.length > 0;
}

export async function POST(request: Request) {
  const rlog = routeLogger("POST", "/api/push/subscribe");
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 403 });
  }

  let sub: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } | null } | null;
  try {
    sub = await request.json();
  } catch {
    return NextResponse.json({ error: "リクエストが不正です" }, { status: 400 });
  }

  const endpoint = sub?.endpoint;
  const p256dh = sub?.keys?.p256dh;
  const auth = sub?.keys?.auth;
  if (!isNonEmptyString(endpoint) || !isNonEmptyString(p256dh) || !isNonEmptyString(auth)) {
    return NextResponse.json({ error: "購読情報が不正です" }, { status: 400 });
  }

  // 所有権チェックと登録を atomic に行う。
  // create が一意制約違反（既存 endpoint）の場合は、自分の購読に限って更新する。
  // 他ユーザー所有の endpoint は updateMany の where に一致せず 0 件 → 409（通知の乗っ取り防止）
  try {
    await prisma.pushSubscription.create({
      data: { userId: user.id, endpoint, p256dh, auth },
    });
  } catch (e) {
    if (!isUniqueViolation(e)) throw e;
    const { count } = await prisma.pushSubscription.updateMany({
      where: { endpoint, userId: user.id },
      data: { p256dh, auth },
    });
    if (count === 0) {
      rlog.warn("Push subscription endpoint owned by another user", { userId: user.id });
      return NextResponse.json({ error: "この購読は登録できません" }, { status: 409 });
    }
  }

  rlog.info("Push subscription registered", { userId: user.id, role: user.role });
  return NextResponse.json({ ok: true });
}
