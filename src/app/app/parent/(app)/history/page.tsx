"use client";

import { useEffect, useState } from "react";
import { CATEGORY_LABEL } from "@/lib/constants";
import { calcActualXP } from "@/lib/xpRange";
import type { Category } from "@/types";
import LoadingSpinner from "@/components/LoadingSpinner";

type HistoryStatus = "APPROVED" | "SKIPPED" | "NO_ACTION";

type HistoryItem = {
  id: string | null;
  status: HistoryStatus;
  date: string;
  approvedAt: string | null;
  comment: string | null;
  deadlineBonusEarned: boolean;
  photoUrl: string | null;
  child: { id: string; name: string; monsterName: string | null; side: string | null } | null;
  template: { title: string; emoji: string; category: Category; photoBonus?: boolean };
};

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const DAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

export default function HistoryPage() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [viewMonth, setViewMonth] = useState<Date>(
    new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [photoModal, setPhotoModal] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/quests/history?date=${formatDate(selectedDate)}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setItems(data))
      .finally(() => setLoading(false));
  }, [selectedDate]);

  const approved = items.filter((i) => i.status === "APPROVED");
  const skipped = items.filter((i) => i.status === "SKIPPED");
  const noAction = items.filter((i) => i.status === "NO_ACTION");

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const canGoNext = !(
    year === today.getFullYear() && month === today.getMonth()
  );

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-serif text-quest-gold text-2xl tracking-wider">
          📅 過去の記録
        </h1>
        <p className="text-quest-dim text-sm mt-1">日付を選んでその日のタスクを確認</p>
      </div>

      {/* Calendar */}
      <div className="bg-quest-card border border-quest-border rounded-xl p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => setViewMonth(new Date(year, month - 1, 1))}
            className="text-quest-dim hover:text-quest-text px-3 py-1 rounded-lg hover:bg-white/5 transition-colors"
          >
            ◀
          </button>
          <span className="text-quest-text font-medium">
            {year}年{month + 1}月
          </span>
          <button
            onClick={() => setViewMonth(new Date(year, month + 1, 1))}
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

        <div className="grid grid-cols-7 text-center text-sm">
          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
            const d = new Date(year, month, day);
            const isFuture = d > today;
            const isSelected = formatDate(d) === formatDate(selectedDate);
            const isToday = formatDate(d) === formatDate(today);
            return (
              <button
                key={day}
                onClick={() => !isFuture && setSelectedDate(d)}
                disabled={isFuture}
                className={[
                  "py-1.5 rounded-lg transition-colors",
                  isFuture ? "text-quest-dim/30 cursor-default" : "hover:bg-quest-gold/10",
                  isSelected ? "bg-quest-gold/20 text-quest-gold font-bold" : "",
                  isToday && !isSelected ? "text-quest-gold font-medium" : "",
                  !isSelected && !isToday && !isFuture ? "text-quest-text" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected date header */}
      <div className="mb-4">
        <h2 className="text-quest-text font-medium">
          {selectedDate.getFullYear()}年{selectedDate.getMonth() + 1}月{selectedDate.getDate()}日
        </h2>
        {!loading && (
          <p className="text-quest-dim text-sm mt-0.5">
            {approved.length}件完了 · {skipped.length}件スキップ · {noAction.length}件未対応
          </p>
        )}
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="flex flex-col gap-4">
          {items.length === 0 && (
            <p className="text-quest-dim text-sm text-center py-12">
              この日のタスク記録はありません
            </p>
          )}
          {items.map((item, idx) => {
            const isApproved = item.status === "APPROVED";
            const isSkipped = item.status === "SKIPPED";
            const cat = CATEGORY_LABEL[item.template.category];
            const childName =
              item.child?.monsterName || item.child?.name || "不明";

            return (
              <div
                key={item.id ?? `no-action-${idx}`}
                className={[
                  "bg-quest-card border rounded-xl p-5",
                  isApproved
                    ? "border-quest-border"
                    : isSkipped
                    ? "border-orange-500/40"
                    : "border-quest-dim/20 opacity-60",
                ].join(" ")}
              >
                <div className="flex items-start gap-4">
                  <div className="text-3xl">{item.template.emoji}</div>
                  <div className="flex-1">
                    <p className="text-sm text-quest-dim">🧒 {childName}</p>
                    <p className="text-base font-medium mt-1">
                      {item.template.title}
                    </p>
                    <p className="text-xs text-quest-dim mt-1">
                      {cat.emoji} {cat.name}
                      {isApproved ? ` · +${calcActualXP(item.deadlineBonusEarned, !!item.template.photoBonus, !!item.photoUrl)}pt` : ""}
                    </p>
                    {item.photoUrl && (
                      <button
                        onClick={() => setPhotoModal(item.photoUrl)}
                        className="flex items-center gap-2 text-sm text-quest-dim border border-quest-border rounded-xl px-4 py-2.5 mt-2 w-full justify-center hover:border-quest-gold/40 hover:text-quest-gold transition-colors"
                      >
                        📷 写真を見る
                      </button>
                    )}
                    {item.comment && (
                      <p className="text-xs text-quest-dim mt-2 bg-quest-bg rounded-lg px-3 py-2">
                        💬 {item.comment}
                      </p>
                    )}
                  </div>
                  <div className="text-right text-xs text-quest-dim shrink-0">
                    {isApproved ? (
                      <span className="text-quest-gold font-medium">✓ 完了</span>
                    ) : isSkipped ? (
                      <span className="text-orange-400 font-medium">⏭ スキップ</span>
                    ) : (
                      <span className="text-quest-dim font-medium">— 未対応</span>
                    )}
                    {item.approvedAt && (
                      <>
                        <br />
                        {new Date(item.approvedAt).toLocaleTimeString("ja-JP", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 写真モーダル */}
      {photoModal && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
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
