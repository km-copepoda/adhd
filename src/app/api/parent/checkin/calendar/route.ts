// 親代理: 子供のチェックイン履歴を月単位で返す。
//
// GET /api/parent/checkin/calendar?childId=X&month=YYYY-MM
// - 親セッション + 同一 family の子供かどうかを resolveTargetChild で検証
// - 履歴ページ (HistoryContent) の HeatmapGrid 下に重ねて表示する用

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { resolveTargetChild } from "@/lib/parentChildView";

const MONTH_PATTERN = /^(\d{4})-(\d{2})$/;

export async function GET(request: Request) {
  const parent = await getCurrentUser();
  if (!parent) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const url = new URL(request.url);
  const childId = url.searchParams.get("childId");
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

  const resolved = await resolveTargetChild(parent, childId);
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }
  const child = resolved.child as { id: string; checkinDeadlineTime?: string | null };

  if (!child.checkinDeadlineTime) {
    return NextResponse.json({
      enabled: false,
      year,
      month,
      deadline: null,
      logs: [],
      enabledSince: null,
      currentStreak: 0,
      bestStreak: 0,
    });
  }

  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0)); // 月末

  const [logs, earliest, streak] = await Promise.all([
    prisma.checkinLog.findMany({
      where: { childId: child.id, date: { gte: start, lte: end } },
      orderBy: { date: "asc" },
      select: { date: true, success: true },
    }),
    prisma.checkinLog.findFirst({
      where: { childId: child.id },
      orderBy: { date: "asc" },
      select: { date: true },
    }),
    prisma.streak.findUnique({ where: { childId: child.id } }),
  ]);

  // ログが 1 件もない子供は「機能の有効期間がまだ始まっていない」とみなして
  // 今日 JST を入れる。過去月を見れば全日が empty になり、今月なら今日以降だけ
  // today/future として描かれる。
  // 「翌月分の最古ログ」より前は empty にしたいので、月をまたいで最古を取得する。
  const enabledSince = earliest ? formatYmd(earliest.date) : todayJstStr();

  return NextResponse.json({
    enabled: true,
    year,
    month,
    deadline: child.checkinDeadlineTime,
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
  const jst = new Date(Date.now() + 9 * 3600000);
  return formatYmd(jst);
}

function formatYmd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
