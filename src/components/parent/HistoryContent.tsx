"use client";

import { useEffect, useState } from "react";
import LoadingSpinner from "@/components/LoadingSpinner";
import HeatmapGrid, { type CheckinCellState } from "@/components/parent/HeatmapGrid";
import HistoryItemCard from "@/components/parent/HistoryItemCard";
import { useHistoryData } from "@/hooks/useHistoryData";
import { todayStringJST } from "@/lib/date";
import { buildMonthGrid } from "@/lib/checkin.calendar";

type CheckinResponse = {
  enabled: boolean;
  year: number;
  month: number;
  deadline: string | null;
  logs: { date: string; success: boolean }[];
  enabledSince: string | null;
  currentStreak: number;
  bestStreak: number;
};

export default function HistoryContent() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [viewMonth, setViewMonth] = useState<Date>(
    new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const [photoModal, setPhotoModal] = useState<string | null>(null);

  const {
    children,
    selectedChildId,
    setSelectedChildId,
    items,
    monthlySummary,
    loadingItems,
    loadingSummary,
    isFirstLoad,
  } = useHistoryData(selectedDate, viewMonth);

  const [checkin, setCheckin] = useState<CheckinResponse | null>(null);

  useEffect(() => {
    if (!selectedChildId) {
      setCheckin(null);
      return;
    }
    const y = viewMonth.getFullYear();
    const m = viewMonth.getMonth() + 1;
    const monthParam = `${y}-${String(m).padStart(2, "0")}`;
    setCheckin(null);
    fetch(`/api/parent/checkin/calendar?childId=${selectedChildId}&month=${monthParam}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: CheckinResponse | null) => setCheckin(d))
      .catch(() => setCheckin(null));
  }, [selectedChildId, viewMonth]);

  const checkinDays: Record<string, CheckinCellState> | undefined = (() => {
    if (!checkin || !checkin.enabled) return undefined;
    const cells = buildMonthGrid({
      year: checkin.year,
      month: checkin.month,
      logs: checkin.logs,
      todayStr: todayStringJST(),
      deadline: checkin.deadline ?? "23:59",
      now: new Date(),
      enabledSince: checkin.enabledSince ?? undefined,
    });
    const map: Record<string, CheckinCellState> = {};
    for (const c of cells) {
      // future/empty はアイコンなし（HeatmapGrid 側で非描画）にするため除外
      if (c.state === "success" || c.state === "fail" || c.state === "today") {
        map[c.date] = c.state;
      }
    }
    return map;
  })();

  const approved = items.filter((i) => i.status === "APPROVED");
  const skipped = items.filter((i) => i.status === "SKIPPED");
  const noAction = items.filter((i) => i.status === "NO_ACTION");

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();

  const selectedChild = children.find((c) => c.id === selectedChildId);
  const childDisplayName = selectedChild?.monsterName || selectedChild?.name || "";

  if (loadingSummary || (isFirstLoad && loadingItems)) {
    return (
      <div className="flex justify-center py-20">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-serif text-quest-gold text-2xl tracking-wider">
          📅 過去の記録
        </h1>
        <p className="text-quest-dim text-sm mt-1">日付を選んでその日のタスクを確認</p>
      </div>

      {children.length > 1 && (
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {children.map((child) => (
            <button
              key={child.id}
              onClick={() => setSelectedChildId(child.id)}
              className={[
                "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs whitespace-nowrap transition-colors",
                selectedChildId === child.id
                  ? "bg-quest-gold/15 border border-quest-gold text-quest-gold"
                  : "bg-quest-card border border-quest-border text-quest-dim hover:text-quest-text",
              ].join(" ")}
            >
              🧒 {child.monsterName || child.name}
            </button>
          ))}
        </div>
      )}

      {selectedChildId && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-quest-card border border-quest-border rounded-xl p-3 text-center">
            <div className="text-xl font-bold text-quest-gold leading-tight">
              {loadingSummary ? "…" : (monthlySummary?.achievedDays ?? 0)}
            </div>
            <div className="text-[10px] text-quest-dim mt-1">{month + 1}月の達成日数</div>
          </div>
          <div className="bg-quest-card border border-quest-border rounded-xl p-3 text-center">
            <div className="text-xl font-bold text-teal-400 leading-tight">
              {loadingSummary ? "…" : (monthlySummary?.totalApproved ?? 0)}
            </div>
            <div className="text-[10px] text-quest-dim mt-1">完了タスク数</div>
          </div>
          <div className="bg-quest-card border border-quest-border rounded-xl p-3 text-center">
            <div className="text-xl font-bold text-green-400 leading-tight">
              {loadingSummary ? "…" : `+${monthlySummary?.totalXp ?? 0}`}
            </div>
            <div className="text-[10px] text-quest-dim mt-1">獲得XP</div>
          </div>
        </div>
      )}

      <HeatmapGrid
        viewMonth={viewMonth}
        today={today}
        selectedDate={selectedDate}
        days={monthlySummary?.days}
        onPrevMonth={() => setViewMonth(new Date(year, month - 1, 1))}
        onNextMonth={() => setViewMonth(new Date(year, month + 1, 1))}
        onSelectDate={setSelectedDate}
        checkinDays={checkinDays}
      />

      {checkin?.enabled && checkin.currentStreak > 0 && (
        <div className="flex justify-end mb-4 -mt-4">
          <span className="text-xs text-orange-400 font-bold" data-testid="parent-checkin-current-streak">
            🔥 チェックイン {checkin.currentStreak}日連続
          </span>
        </div>
      )}

      <div className="mb-4">
        <h2 className="text-quest-text font-medium">
          {selectedDate.getFullYear()}年{selectedDate.getMonth() + 1}月{selectedDate.getDate()}日
          {childDisplayName && (
            <span className="text-quest-dim text-sm font-normal ml-2">🧒 {childDisplayName}</span>
          )}
        </h2>
        {!loadingItems && (
          <p className="text-quest-dim text-sm mt-0.5">
            {approved.length}件完了 · {skipped.length}件スキップ · {noAction.length}件未対応
          </p>
        )}
      </div>

      {loadingItems ? (
        <LoadingSpinner />
      ) : (
        <div className="flex flex-col gap-4">
          {items.length === 0 && (
            <p className="text-quest-dim text-sm text-center py-12">
              この日のタスク記録はありません
            </p>
          )}
          {items.map((item, idx) => (
            <HistoryItemCard
              key={item.id ?? `no-action-${idx}`}
              item={item}
              showChildName={children.length > 1}
              onPhotoClick={setPhotoModal}
            />
          ))}
        </div>
      )}

      {photoModal && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4"
          onClick={() => setPhotoModal(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photoModal}
            alt="報告写真"
            className="max-w-full max-h-full object-contain rounded-xl cursor-pointer"
          />
        </div>
      )}
    </div>
  );
}
