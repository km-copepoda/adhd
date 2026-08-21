"use client";

import { useEffect, useState } from "react";
import { buildWeekStrip, type CalendarCell } from "@/lib/checkin.calendar";

interface CalendarApiResponse {
  enabled: boolean;
  days: number;
  deadline: string | null;
  logs: { date: string; success: boolean }[];
  enabledSince: string | null;
  currentStreak: number;
  bestStreak: number;
}

interface Props {
  deadline: string;
  todayStr: string;
  justNow?: boolean;
  /** "standalone"（既定）: 見出し・締切ラベル・連続日数行を含む従来表示。"embedded": グリッドのみ（呼び出し元がピル等に埋め込む用途）。 */
  variant?: "standalone" | "embedded";
}

// 日=0..土=6 (JS Date.getUTCDay() 準拠) で引く
const DAY_LABELS_SUN_START = ["日", "月", "火", "水", "木", "金", "土"];
const STRIP_DAYS = 7;

export default function CheckinCalendar({
  deadline,
  todayStr,
  justNow,
  variant = "standalone",
}: Props) {
  const [data, setData] = useState<CalendarApiResponse | null>(null);
  const [now] = useState(() => new Date());

  useEffect(() => {
    fetch(`/api/checkin/calendar?days=${STRIP_DAYS}`)
      .then((r) => r.json())
      .then((d: CalendarApiResponse) => setData(d))
      .catch(() => {});
  }, []);

  if (!data || !data.enabled) return null;

  const cells = buildWeekStrip({
    todayStr,
    days: STRIP_DAYS,
    logs: data.logs,
    deadline,
    now,
    enabledSince: data.enabledSince ?? undefined,
  });

  const isEmbedded = variant === "embedded";

  return (
    <div className={isEmbedded ? "" : "bg-quest-card border border-quest-border rounded-xl p-3 mb-4"}>
      {!isEmbedded && (
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-serif text-quest-gold text-sm tracking-wider">
            直近7日 チェックイン
          </h2>
          <span className="text-[10px] text-quest-dim">締切 {deadline}</span>
        </div>
      )}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell) => (
          <Cell
            key={cell.date}
            cell={cell}
            isToday={cell.date === todayStr}
            justNow={!!justNow}
          />
        ))}
      </div>
      {!isEmbedded && data.currentStreak > 0 && (
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
    if (cell.state === "empty") return "-";
    if (cell.state === "success") return "🌟";
    if (cell.state === "fail") return "😢";
    if (cell.state === "today") return "⭐";
    if (cell.state === "future") return "";
    return "";
  })();
  const weekdayLabel = DAY_LABELS_SUN_START[cell.weekday];
  // 土=6 を青、日=0 を赤
  const weekdayClass =
    cell.weekday === 6 ? "text-blue-400" : cell.weekday === 0 ? "text-red-400" : "text-quest-dim";
  return (
    <div
      data-testid={`cell-${cell.date}`}
      data-state={cell.state}
      data-animate={shouldAnimate ? "true" : "false"}
      className={`aspect-square flex flex-col items-center justify-center rounded text-[9px] bg-quest-bg ${
        cell.state === "today" ? "ring-1 ring-quest-gold/50" : ""
      }`}
      style={shouldAnimate ? { animation: "stampPop 0.6s ease-out" } : undefined}
    >
      <span className={`leading-none ${weekdayClass}`}>{weekdayLabel}</span>
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
