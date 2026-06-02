"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  getBulletinLogEmoji,
  groupBulletinLogsByDate,
  formatBulletinDateHeading,
  coalesceTaskProgress,
  coalesceBurst,
} from "@/lib/bulletinLog.data";

type LogEntry = {
  id: string;
  childId: string;
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

export default function GatheringBoard({ groupId, childId }: Props) {
  const [logs, setLogs] = useState<LogEntry[]>([]);

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

  // Realtime: 新しいログを購読
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

  // 日付グルーピング → 同一子供・同日のTASK_*間引き → 同(子供,種別)バーストの束ね
  const renderedGroups = groupBulletinLogsByDate(logs).map((g) => ({
    dateStr: g.dateStr,
    entries: coalesceBurst(coalesceTaskProgress(g.logs)),
  }));

  if (logs.length === 0) {
    return (
      <div className="bg-quest-card border border-quest-border rounded-xl p-4">
        <p className="text-quest-dim/60 text-xs text-center py-6">
          まだ書き込みはないよ<br />クエストをこなすと自動でログが流れるよ！
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {renderedGroups.map((g) => (
        <section
          key={g.dateStr}
          className="bg-quest-card border border-quest-border rounded-xl p-4"
        >
          <h2 className="text-sm font-bold mb-3 text-quest-gold/80">
            📋 {formatBulletinDateHeading(g.dateStr)}
          </h2>
          <div className="space-y-2">
            {g.entries.map(({ primary, items }) => (
              <div key={primary.id} className="flex gap-2 items-start text-sm">
                <span className="text-base leading-snug flex-shrink-0">
                  {getBulletinLogEmoji(primary.type)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="leading-snug">
                    {primary.message}
                    {items.length > 1 && (
                      <span className="ml-1 text-xs font-bold text-quest-gold/80">
                        ×{items.length}
                      </span>
                    )}
                  </p>
                  <p className="text-[10px] text-quest-dim/60 mt-0.5">
                    {formatTime(primary.createdAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
