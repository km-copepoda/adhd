"use client";

import { DAY_LABELS } from "@/lib/categories";
import { formatDate, getHeatLevel, HEAT_CLASS, type DaySummary } from "@/lib/heatmap";

type HeatmapGridProps = {
  viewMonth: Date;
  today: Date;
  selectedDate: Date;
  days: Record<string, DaySummary> | undefined;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onSelectDate: (d: Date) => void;
};

export default function HeatmapGrid({
  viewMonth,
  today,
  selectedDate,
  days,
  onPrevMonth,
  onNextMonth,
  onSelectDate,
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

          return (
            <button
              key={day}
              onClick={() => !isFuture && onSelectDate(d)}
              disabled={isFuture}
              className={[
                "aspect-square rounded-md flex items-center justify-center transition-transform text-xs",
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
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-1.5 mt-3 justify-end text-[9px] text-quest-dim/70">
        <div className="w-2.5 h-2.5 rounded-sm bg-quest-card border border-quest-border" />
        <span>なし</span>
        <div className="w-2.5 h-2.5 rounded-sm bg-teal-500/20 ml-1" />
        <div className="w-2.5 h-2.5 rounded-sm bg-teal-500/45" />
        <div className="w-2.5 h-2.5 rounded-sm bg-quest-gold/55 border border-quest-gold" />
        <span>完了多</span>
        <div className="w-2.5 h-2.5 rounded-sm bg-orange-500/20 ml-1" />
        <span>スキップ</span>
      </div>
    </div>
  );
}
