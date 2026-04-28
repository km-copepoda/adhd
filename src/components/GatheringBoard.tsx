"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

type LogEntry = {
  id: string;
  message: string;
  type: string;
  createdAt: string;
};

type Props = {
  groupId: string;
  /** 親画面の場合は対象子供のID。子供画面では undefined */
  childId?: string;
};

const TAB_DAYS_AGO = [0, 1, 2, 3] as const;

function tabLabel(daysAgo: number): string {
  if (daysAgo === 0) return "きょう";
  return `${daysAgo}日前`;
}

/** JST の (今日 - daysAgo) を "YYYY-MM-DD" で返す */
function jstDateString(daysAgo: number): string {
  const jstNow = new Date(Date.now() + 9 * 3600000);
  const target = new Date(jstNow.getTime() - daysAgo * 86400000);
  return target.toISOString().slice(0, 10);
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

function logEmoji(type: string) {
  if (type.startsWith("TASK")) return "⚔️";
  if (type === "BADGE_UNLOCKED") return "🏅";
  if (type === "STREAK_TITLE") return "🔥";
  if (type === "MONSTER_EVOLVED") return "✨";
  if (type === "MONSTER_REBORN") return "🥚";
  return "📢";
}

export default function GatheringBoard({ groupId, childId }: Props) {
  const [activeDaysAgo, setActiveDaysAgo] = useState<number>(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const todayStr = jstDateString(0);

  async function fetchLogs(daysAgo: number) {
    const params = new URLSearchParams();
    params.set("date", jstDateString(daysAgo));
    if (childId) params.set("childId", childId);
    const res = await fetch(`/api/gathering/board?${params.toString()}`);
    if (res.ok) setLogs(await res.json());
  }

  // タブ切替時にログ再取得
  useEffect(() => {
    fetchLogs(activeDaysAgo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDaysAgo, groupId, childId]);

  // Realtime: 「きょう」タブの時のみ INSERT を購読
  useEffect(() => {
    if (activeDaysAgo !== 0) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`bulletin-${groupId}-${childId ?? "self"}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "BulletinLog", filter: `groupId=eq.${groupId}` },
        (payload) => {
          const entry = payload.new as LogEntry & { date?: string };
          // 今日分のみ画面に追加（万一 date が今日でなければ無視）
          if (!entry.date || entry.date.slice(0, 10) === todayStr) {
            setLogs((prev) => [entry, ...prev]);
          }
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeDaysAgo, groupId, childId, todayStr]);

  return (
    <div className="bg-quest-card border border-quest-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-quest-dim">📋 けいじばん</h2>
      </div>

      {/* 日付タブ */}
      <div className="flex gap-1 mb-3 overflow-x-auto" role="tablist" aria-label="日付">
        {TAB_DAYS_AGO.map((d) => (
          <button
            key={d}
            role="tab"
            aria-selected={activeDaysAgo === d}
            onClick={() => setActiveDaysAgo(d)}
            className={`flex-1 px-2 py-1 rounded-md text-xs border transition-colors whitespace-nowrap ${
              activeDaysAgo === d
                ? "border-quest-gold bg-quest-gold/10 text-quest-gold"
                : "border-quest-border text-quest-dim hover:border-quest-gold/50"
            }`}
          >
            {tabLabel(d)}
          </button>
        ))}
      </div>

      {logs.length === 0 ? (
        <p className="text-quest-dim/60 text-xs text-center py-6">
          {activeDaysAgo === 0
            ? "きょうはまだ書き込みがないよ"
            : "この日の書き込みはないよ"}
        </p>
      ) : (
        <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
          {logs.map((entry) => (
            <div key={entry.id} className="flex gap-2 items-start text-sm">
              <span className="text-base leading-snug flex-shrink-0">{logEmoji(entry.type)}</span>
              <div className="flex-1 min-w-0">
                <p className="leading-snug">{entry.message}</p>
                <p className="text-[10px] text-quest-dim/60 mt-0.5">{formatTime(entry.createdAt)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
