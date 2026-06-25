"use client";

import { useEffect, useState } from "react";
import { buildCalendarGrid, type CalendarCell } from "@/lib/checkin.calendar";

interface CalendarApiResponse {
  enabled: boolean;
  year: number;
  month: number;
  deadline: string | null;
  logs: { date: string; success: boolean }[];
  currentStreak: number;
  bestStreak: number;
}

interface Props {
  deadline: string;
  todayStr: string;
  justNow?: boolean;
}

const DAY_LABELS = ["月", "火", "水", "木", "金", "土", "日"];

export default function CheckinCalendar({ deadline, todayStr, justNow }: Props) {
  const [data, setData] = useState<CalendarApiResponse | null>(null);
  const [now] = useState(() => new Date());

  const [year, month] = (() => {
    const [y, m] = todayStr.split("-").map(Number);
    return [y, m];
  })();

  useEffect(() => {
    const monthParam = `${year}-${String(month).padStart(2, "0")}`;
    fetch(`/api/checkin/calendar?month=${monthParam}`)
      .then((r) => r.json())
      .then((d: CalendarApiResponse) => setData(d))
      .catch(() => {});
  }, [year, month]);

  if (!data || !data.enabled) return null;

  const grid = buildCalendarGrid({
    year: data.year,
    month: data.month,
    logs: data.logs,
    todayStr,
    deadline,
    now,
  });

  return (
    <div className="bg-quest-card border border-quest-border rounded-xl p-3 mb-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-serif text-quest-gold text-sm tracking-wider">
          {data.month}月 チェックイン
        </h2>
        <span className="text-[10px] text-quest-dim">締切 {deadline}</span>
      </div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAY_LABELS.map((label, i) => (
          <div
            key={label}
            className={`text-center text-[10px] ${
              i === 5 ? "text-blue-400" : i === 6 ? "text-red-400" : "text-quest-dim"
            }`}
          >
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {grid.flat().map((cell) => (
          <Cell
            key={cell.date}
            cell={cell}
            isToday={cell.date === todayStr}
            justNow={!!justNow}
          />
        ))}
      </div>
      {data.currentStreak > 0 && (
        <p
          className="text-center text-xs text-orange-400 font-bold mt-3"
          data-testid="checkin-current-streak"
        >
          🔥 {data.currentStreak}日連続！
        </p>
      )}
    </div>
  );
}

function Cell({
  cell,
  isToday,
  justNow,
}: {
  cell: CalendarCell;
  isToday: boolean;
  justNow: boolean;
}) {
  const shouldAnimate = isToday && cell.state === "success" && justNow;
  const display = (() => {
    if (!cell.inMonth || cell.state === "empty") return "";
    if (cell.state === "success") return "🌟";
    if (cell.state === "fail") return "😢";
    if (cell.state === "today") return "⭐";
    return "";
  })();
  return (
    <div
      data-testid={`cell-${cell.date}`}
      data-state={cell.state}
      data-animate={shouldAnimate ? "true" : "false"}
      className={`aspect-square flex flex-col items-center justify-center rounded text-[9px] ${
        cell.inMonth ? "bg-quest-bg" : "opacity-30"
      } ${cell.state === "today" ? "ring-1 ring-quest-gold/50" : ""}`}
      style={shouldAnimate ? { animation: "stampPop 0.6s ease-out" } : undefined}
    >
      <span className="text-quest-dim leading-none">{cell.day}</span>
      <span className="text-base leading-none">{display}</span>
      <style>{`
        @keyframes stampPop {
          0% { transform: scale(0.3) rotate(-20deg); opacity: 0 }
          60% { transform: scale(1.3) rotate(10deg); opacity: 1 }
          100% { transform: scale(1) rotate(0); opacity: 1 }
        }
      `}</style>
    </div>
  );
}
