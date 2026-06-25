import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const DEFAULT_DAYS = 7;
const MAX_DAYS = 31;

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }
  if (user.role !== "CHILD") {
    return NextResponse.json({ error: "子供のみ利用できます" }, { status: 403 });
  }

  const url = new URL(request.url);
  const daysParam = url.searchParams.get("days");
  let days = DEFAULT_DAYS;
  if (daysParam !== null) {
    const n = Number(daysParam);
    if (!Number.isInteger(n) || n < 1 || n > MAX_DAYS) {
      return NextResponse.json(
        { error: `days は 1〜${MAX_DAYS} の整数` },
        { status: 400 },
      );
    }
    days = n;
  }

  const u = user as { checkinDeadlineTime?: string | null };
  if (!u.checkinDeadlineTime) {
    return NextResponse.json({
      enabled: false,
      days,
      deadline: null,
      logs: [],
      enabledSince: null,
      currentStreak: 0,
      bestStreak: 0,
    });
  }

  // 直近 days 日分の範囲（JST 0:00 起点 = UTC 0:00 として保存されている）
  const todayStr = todayJstStr();
  const todayUTC = new Date(todayStr + "T00:00:00Z");
  const start = new Date(todayUTC.getTime() - (days - 1) * 86400000);

  const [logs, earliest, streak] = await Promise.all([
    prisma.checkinLog.findMany({
      where: { childId: user.id, date: { gte: start, lte: todayUTC } },
      orderBy: { date: "asc" },
      select: { date: true, success: true },
    }),
    prisma.checkinLog.findFirst({
      where: { childId: user.id },
      orderBy: { date: "asc" },
      select: { date: true },
    }),
    prisma.streak.findUnique({ where: { childId: user.id } }),
  ]);

  // ログが 1 件もないときは「今日からが機能の有効期間」とみなして
  // 過去日を空表示にする（リリース直後／親が設定した直後で過去全部 fail を防ぐ）
  const enabledSince = earliest ? formatYmd(earliest.date) : todayStr;

  return NextResponse.json({
    enabled: true,
    days,
    deadline: u.checkinDeadlineTime,
    logs: logs.map((l: { date: Date; success: boolean }) => ({
      date: formatYmd(l.date),
      success: l.success,
    })),
    enabledSince,
    currentStreak: streak?.checkinCurrentStreak ?? 0,
    bestStreak: streak?.checkinBestStreak ?? 0,
  });
}

function todayJstStr(): string {
  const nowUtc = Date.now();
  const jst = new Date(nowUtc + 9 * 3600000);
  return formatYmd(jst);
}

function formatYmd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
