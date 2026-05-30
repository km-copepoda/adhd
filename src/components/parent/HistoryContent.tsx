"use client";

import { useEffect, useRef, useState } from "react";
import { CATEGORY_LABEL } from "@/lib/categories";
import { calcActualXP } from "@/lib/xp";
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

type DaySummary = { approved: number; skipped: number; total: number };

type MonthlySummary = {
  days: Record<string, DaySummary>;
  achievedDays: number;
  totalApproved: number;
  totalXp: number;
};

type Child = { id: string; name: string; monsterName: string | null };

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getHeatLevel(day: DaySummary | undefined): "none" | "lv1" | "lv2" | "lv3" | "lv4" | "lv5" | "lv6" | "skip" {
  if (!day || day.total === 0) return "none";
  if (day.approved === 0) return "skip";
  const pct = (day.approved / day.total) * 100;
  if (pct >= 100) return "lv6";
  if (pct >= 80) return "lv5";
  if (pct >= 60) return "lv4";
  if (pct >= 40) return "lv3";
  if (pct >= 20) return "lv2";
  return "lv1";
}

const HEAT_CLASS: Record<ReturnType<typeof getHeatLevel>, string> = {
  none: "bg-quest-card border border-quest-border text-quest-dim/50",
  lv1: "bg-teal-500/10 border border-teal-500/20 text-teal-400/60",
  lv2: "bg-teal-500/20 border border-teal-500/30 text-teal-300",
  lv3: "bg-teal-500/35 border border-teal-500/45 text-teal-200",
  lv4: "bg-teal-500/50 border border-teal-500/60 text-white",
  lv5: "bg-quest-gold/40 border border-quest-gold/60 text-white",
  lv6: "bg-quest-gold/65 border border-quest-gold text-white font-semibold",
  skip: "bg-orange-500/20 border border-orange-500/30 text-orange-400",
};

const DAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

export default function HistoryContent() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [viewMonth, setViewMonth] = useState<Date>(
    new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [monthlySummary, setMonthlySummary] = useState<MonthlySummary | null>(null);
  const [loadingItems, setLoadingItems] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const firstLoad = useRef(true);
  const [photoModal, setPhotoModal] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/family/code")
      .then((res) => (res.ok ? res.json() : { members: [] }))
      .then((data) => {
        const kids: Child[] = (data.members ?? [])
          .filter((m: { role: string }) => m.role === "CHILD")
          .map((m: { id: string; name: string; monsterName: string | null }) => ({
            id: m.id,
            name: m.name,
            monsterName: m.monsterName,
          }));
        setChildren(kids);
        if (kids.length > 0) {
          setSelectedChildId(kids[0].id);
        } else {
          setLoadingSummary(false);
        }
      });
  }, []);

  useEffect(() => {
    if (!selectedChildId) return;
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth() + 1;
    setLoadingSummary(true);
    setMonthlySummary(null);
    fetch(`/api/quests/monthly-summary?year=${year}&month=${month}&childId=${selectedChildId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setMonthlySummary(data))
      .finally(() => setLoadingSummary(false));
  }, [viewMonth, selectedChildId]);

  useEffect(() => {
    if (!selectedChildId) return;
    setLoadingItems(true);
    fetch(`/api/quests/history?date=${formatDate(selectedDate)}&childId=${selectedChildId}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setItems(data))
      .finally(() => {
        firstLoad.current = false;
        setLoadingItems(false);
      });
  }, [selectedDate, selectedChildId]);

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

  const selectedChild = children.find((c) => c.id === selectedChildId);
  const childDisplayName = selectedChild?.monsterName || selectedChild?.name || "";

  if (loadingSummary || (firstLoad.current && loadingItems)) {
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
            const heatLevel = isFuture ? "none" : getHeatLevel(monthlySummary?.days[dateStr]);

            return (
              <button
                key={day}
                onClick={() => !isFuture && setSelectedDate(d)}
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
                    {children.length > 1 && (
                      <p className="text-sm text-quest-dim">🧒 {childName}</p>
                    )}
                    <p className="text-base font-medium mt-1">
                      {item.template.title}
                    </p>
                    <p className="text-xs text-quest-dim mt-1">
                      {cat.emoji} {cat.name}
                      {isApproved ? ` · +${calcActualXP(item.deadlineBonusEarned, !!item.template.photoBonus, !!item.photoUrl)}pt` : ""}
                    </p>
                    {item.photoUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.photoUrl}
                        alt="報告写真"
                        className="w-full h-32 object-cover rounded-xl mt-2 cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => setPhotoModal(item.photoUrl)}
                      />
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
