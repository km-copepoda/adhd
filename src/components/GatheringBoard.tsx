"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getBulletinLogEmoji, groupBulletinLogsByDate } from "@/lib/gathering";

type LogEntry = {
  id: string;
  message: string;
  type: string;
  date: string;
  createdAt: string;
};

type Props = {
  groupId: string;
  /** 親画面の場合は対象子供のID。子供画面では undefined */
  childId?: string;
};

function formatTime(iso: string) {
  const d = new Date(iso);
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

/** "YYYY-MM-DD" → "M/D（曜）" */
const WEEKDAY = ["日", "月", "火", "水", "木", "金", "土"];
function formatDateHeading(dateStr: string, todayStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const wd = WEEKDAY[date.getUTCDay()];
  const base = `${m}/${d}（${wd}）`;
  if (dateStr === todayStr) return `${base}・きょう`;
  return base;
}

/** JSTの今日を "YYYY-MM-DD" で返す */
function todayStringJST(): string {
  const jstNow = new Date(Date.now() + 9 * 3600000);
  return jstNow.toISOString().slice(0, 10);
}

export default function GatheringBoard({ groupId, childId }: Props) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const todayStr = todayStringJST();

  async function fetchLogs() {
    const params = new URLSearchParams();
    if (childId) params.set("childId", childId);
    const qs = params.toString();
    const res = await fetch(`/api/gathering/board${qs ? `?${qs}` : ""}`);
    if (res.ok) setLogs(await res.json());
  }

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, childId]);

  // Realtime: 新しい今日のログを購読
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`bulletin-${groupId}-${childId ?? "self"}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "BulletinLog", filter: `groupId=eq.${groupId}` },
        (payload) => {
          const entry = payload.new as LogEntry;
          setLogs((prev) => [entry, ...prev]);
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [groupId, childId]);

  const groups = groupBulletinLogsByDate(logs);

  return (
    <div className="bg-quest-card border border-quest-border rounded-xl p-4">
      <h2 className="text-sm font-bold mb-3 text-quest-dim">📋 けいじばん（直近4日）</h2>

      {logs.length === 0 ? (
        <p className="text-quest-dim/60 text-xs text-center py-6">
          まだ書き込みはないよ<br />クエストをこなすと自動でログが流れるよ！
        </p>
      ) : (
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          {groups.map((g) => (
            <section key={g.dateStr}>
              <h3 className="sticky top-0 bg-quest-card text-[11px] font-bold text-quest-gold/80 border-b border-quest-border/60 pb-1 mb-2">
                {formatDateHeading(g.dateStr, todayStr)}の掲示板
              </h3>
              <div className="space-y-2">
                {g.logs.map((entry) => (
                  <div key={entry.id} className="flex gap-2 items-start text-sm">
                    <span className="text-base leading-snug flex-shrink-0">{getBulletinLogEmoji(entry.type)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="leading-snug">{entry.message}</p>
                      <p className="text-[10px] text-quest-dim/60 mt-0.5">{formatTime(entry.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
