import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "PARENT") {
    return NextResponse.json({ error: "親のみ登録可能" }, { status: 403 });
  }

  const sub = await request.json();

  await prisma.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    create: {
      userId: user.id,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
    },
    update: {
      userId: user.id,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
    },
  });

  return NextResponse.json({ ok: true });
}
