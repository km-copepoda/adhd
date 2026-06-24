import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const MONTH_PATTERN = /^(\d{4})-(\d{2})$/;

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }
  if (user.role !== "CHILD") {
    return NextResponse.json({ error: "子供のみ利用できます" }, { status: 403 });
  }

  const url = new URL(request.url);
  const monthParam = url.searchParams.get("month") ?? "";
  const m = MONTH_PATTERN.exec(monthParam);
  if (!m) {
    return NextResponse.json({ error: "month は YYYY-MM 形式" }, { status: 400 });
  }
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) {
    return NextResponse.json({ error: "month は 01〜12" }, { status: 400 });
  }

  const u = user as { checkinDeadlineTime?: string | null };
  if (!u.checkinDeadlineTime) {
    return NextResponse.json({
      enabled: false,
      year,
      month,
      deadline: null,
      logs: [],
      currentStreak: 0,
      bestStreak: 0,
    });
  }

  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0)); // 月末

  const [logs, streak] = await Promise.all([
    prisma.checkinLog.findMany({
      where: { childId: user.id, date: { gte: start, lte: end } },
      orderBy: { date: "asc" },
      select: { date: true, success: true },
    }),
    prisma.streak.findUnique({ where: { childId: user.id } }),
  ]);

  return NextResponse.json({
    enabled: true,
    year,
    month,
    deadline: u.checkinDeadlineTime,
    logs: logs.map((l) => ({ date: formatYmd(l.date), success: l.success })),
    currentStreak: streak?.checkinCurrentStreak ?? 0,
    bestStreak: streak?.checkinBestStreak ?? 0,
  });
}

function formatYmd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
