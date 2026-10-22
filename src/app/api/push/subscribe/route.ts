import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
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

  // 他ユーザーが所有する endpoint は上書きしない（通知の乗っ取り防止）
  const existing = await prisma.pushSubscription.findUnique({ where: { endpoint } });
  if (existing && existing.userId !== user.id) {
    rlog.warn("Push subscription endpoint owned by another user", { userId: user.id });
    return NextResponse.json({ error: "この購読は登録できません" }, { status: 409 });
  }

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { userId: user.id, endpoint, p256dh, auth },
    update: { userId: user.id, p256dh, auth },
  });

  rlog.info("Push subscription registered", { userId: user.id, role: user.role });
  return NextResponse.json({ ok: true });
}
