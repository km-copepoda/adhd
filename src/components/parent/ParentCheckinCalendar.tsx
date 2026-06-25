"use client";

import { useEffect, useState } from "react";
import { DAY_LABELS } from "@/lib/categories";
import { buildMonthGrid, type CalendarCell } from "@/lib/checkin.calendar";

interface ApiResponse {
  enabled: boolean;
  year: number;
  month: number;
  deadline: string | null;
  logs: { date: string; success: boolean }[];
  enabledSince: string | null;
  currentStreak: number;
  bestStreak: number;
}

interface Props {
  childId: string;
  viewMonth: Date;
  todayStr: string; // "YYYY-MM-DD" (JST)
}

export default function ParentCheckinCalendar({ childId, viewMonth, todayStr }: Props) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [now] = useState(() => new Date());

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth() + 1; // 1..12

  useEffect(() => {
    if (!childId) return;
    setLoading(true);
    const monthParam = `${year}-${String(month).padStart(2, "0")}`;
    fetch(`/api/parent/checkin/calendar?childId=${childId}&month=${monthParam}`)
      .then((r) => r.json())
      .then((d: ApiResponse) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [childId, year, month]);

  if (loading || !data) return null;
  if (!data.enabled) return null;

  const cells = buildMonthGrid({
    year: data.year,
    month: data.month,
    logs: data.logs,
    todayStr,
    deadline: data.deadline ?? "23:59",
    now,
    enabledSince: data.enabledSince ?? undefined,
  });

  const leadingOffset = cells.length > 0 ? cells[0].weekday : 0; // 日=0..土=6

  return (
    <div className="bg-quest-card border border-quest-border rounded-xl p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-quest-text font-medium text-sm">
          📅 チェックイン{data.deadline ? `（締切 ${data.deadline}）` : ""}
        </h2>
        {data.currentStreak > 0 && (
          <span
            className="text-xs text-orange-400 font-bold"
            data-testid="parent-checkin-current-streak"
          >
            🔥 {data.currentStreak}日連続
          </span>
        )}
      </div>

      <div className="grid grid-cols-7 text-center text-xs text-quest-dim mb-1">
        {DAY_LABELS.map((d) => (
          <span key={d} className="py-1">
            {d}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs">
        {Array.from({ length: leadingOffset }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}
        {cells.map((cell) => (
          <ParentCheckinCell key={cell.date} cell={cell} />
        ))}
      </div>
    </div>
  );
}

function ParentCheckinCell({ cell }: { cell: CalendarCell }) {
  const display = (() => {
    if (cell.state === "empty") return "-";
    if (cell.state === "success") return "🌟";
    if (cell.state === "fail") return "😢";
    if (cell.state === "today") return "⭐";
    if (cell.state === "future") return "";
    return "";
  })();
  return (
    <div
      data-testid={`parent-cell-${cell.date}`}
      data-state={cell.state}
      className={`aspect-square flex flex-col items-center justify-center rounded text-[9px] bg-quest-bg ${
        cell.state === "today" ? "ring-1 ring-quest-gold/50" : ""
      }`}
    >
      <span className="text-quest-dim leading-none">{cell.day}</span>
      <span className="text-base leading-none">{display}</span>
    </div>
  );
}

