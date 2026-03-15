import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const streak = await prisma.streak.findUnique({
    where: { childId: user.id },
  });

  if (!streak) {
    return NextResponse.json({ error: "ストリーク記録がありません" }, { status: 404 });
  }

  // 今週（月曜起算）に既に使用済みか
  if (streak.restPassUsedAt && isInCurrentWeek(streak.restPassUsedAt)) {
    return NextResponse.json({ error: "今週はすでに休息券を使用済みです" }, { status: 400 });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await prisma.streak.update({
    where: { childId: user.id },
    data: { restPassUsedAt: today },
  });

  return NextResponse.json({ ok: true });
}

function isInCurrentWeek(date: Date): boolean {
  const now = new Date();
  const getMonday = (d: Date) => {
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.getFullYear(), d.getMonth(), diff);
  };
  const currentMonday = getMonday(now);
  const dateMonday = getMonday(new Date(date));
  return currentMonday.getTime() === dateMonday.getTime();
}
