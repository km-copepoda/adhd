"use client";

import { DAY_LABELS } from "@/lib/categories";
import { formatDate, getHeatLevel, HEAT_CLASS, type DaySummary } from "@/lib/heatmap";

export type CheckinCellState = "success" | "fail" | "today" | "future" | "empty";

const CHECKIN_ICON: Partial<Record<CheckinCellState, string>> = {
  success: "🌟",
  fail: "😢",
  today: "⭐",
};

type HeatmapGridProps = {
  viewMonth: Date;
  today: Date;
  selectedDate: Date;
  days: Record<string, DaySummary> | undefined;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onSelectDate: (d: Date) => void;
  /** 日付 (YYYY-MM-DD) → チェックイン状態。渡さなければアイコン非表示。 */
  checkinDays?: Record<string, CheckinCellState>;
};

export default function HeatmapGrid({
  viewMonth,
  today,
  selectedDate,
  days,
  onPrevMonth,
  onNextMonth,
  onSelectDate,
  checkinDays,
}: HeatmapGridProps) {
  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const canGoNext = !(
    year === today.getFullYear() && month === today.getMonth()
  );

  return (
    <div className="bg-quest-card border border-quest-border rounded-xl p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={onPrevMonth}
          className="text-quest-dim hover:text-quest-text px-3 py-1 rounded-lg hover:bg-white/5 transition-colors"
        >
          ◀
        </button>
        <span className="text-quest-text font-medium">
          {year}年{month + 1}月
        </span>
        <button
          onClick={onNextMonth}
          disabled={!canGoNext}
          className="text-quest-dim hover:text-quest-text px-3 py-1 rounded-lg hover:bg-white/5 transition-colors disabled:opacity-30 disabled:cursor-default"
        >
          ▶
        </button>
      </div>

      <div className="grid grid-cols-7 text-center text-xs text-quest-dim mb-1">
        {DAY_LABELS.map((d) => (
          <span key={d} className="py-1">{d}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs">
        {Array.from({ length: firstDayOfWeek }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
          const d = new Date(year, month, day);
          const isFuture = d > today;
          const dateStr = formatDate(d);
          const isSelected = dateStr === formatDate(selectedDate);
          const isToday = dateStr === formatDate(today);
          const heatLevel = isFuture ? "none" : getHeatLevel(days?.[dateStr]);
          const checkinState = checkinDays?.[dateStr];
          const checkinIcon = checkinState ? CHECKIN_ICON[checkinState] : undefined;

          return (
            <button
              key={day}
              onClick={() => !isFuture && onSelectDate(d)}
              disabled={isFuture}
              className={[
                "relative aspect-square rounded-md flex items-center justify-center transition-transform text-xs",
                isFuture
                  ? "text-quest-dim/20 cursor-default"
                  : `${HEAT_CLASS[heatLevel]} hover:scale-110`,
                isSelected ? "outline outline-2 outline-quest-gold outline-offset-1" : "",
                isToday && !isSelected ? "outline outline-2 outline-teal-400 outline-offset-1" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {day}
              {checkinIcon && (
                <span
                  data-testid={`heatmap-checkin-${dateStr}`}
                  data-checkin={checkinState}
                  aria-label={`checkin-${checkinState}`}
                  className="absolute -top-0.5 -right-0.5 text-[9px] leading-none pointer-events-none"
                >
                  {checkinIcon}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 mt-3 justify-end text-[9px] text-quest-dim/70">
        <div className="w-2.5 h-2.5 rounded-sm bg-quest-card border border-quest-border" />
        <span>少</span>
        <div className="w-2.5 h-2.5 rounded-sm bg-[#0e4429] ml-1" />
        <div className="w-2.5 h-2.5 rounded-sm bg-[#006d32]" />
        <div className="w-2.5 h-2.5 rounded-sm bg-[#26a641]" />
        <div className="w-2.5 h-2.5 rounded-sm bg-[#39d353]" />
        <div className="w-2.5 h-2.5 rounded-sm bg-[#56d364]" />
        <span>多</span>
        <div className="w-2.5 h-2.5 rounded-sm bg-orange-500/20 ml-1" />
        <span>スキップ</span>
        {checkinDays && (
          <span className="ml-2">🌟成功 · 😢未達 · ⭐今日</span>
        )}
      </div>
    </div>
  );
}
