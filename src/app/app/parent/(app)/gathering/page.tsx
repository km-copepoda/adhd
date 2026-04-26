"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import LoadingSpinner from "@/components/LoadingSpinner";
import type { GatheringLocationType } from "@/lib/gathering";
import { LOCATION_LABEL, LOCATION_EMOJI, LOCATION_CAPACITY } from "@/lib/gathering";
import GatheringMemberList from "@/components/GatheringMemberList";

type Child = { id: string; name: string; monsterName: string | null };

type Member = {
  id: string;
  name: string;
  monsterName: string;
  monsterImage: string;
  evolutionStage: number;
  isMe: boolean;
};

type GroupInfo = {
  groupId: string;
  location: GatheringLocationType;
  locationLabel: string;
  locationEmoji: string;
  secretWord: string;
  memberCount: number;
  capacity: number;
  members: Member[];
};

type LogEntry = {
  id: string;
  message: string;
  type: string;
  createdAt: string;
};

function formatTime(iso: string) {
  const d = new Date(iso);
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  const mo = d.getMonth() + 1;
  const day = d.getDate();
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return `${h}:${m}`;
  return `${mo}/${day} ${h}:${m}`;
}

function logEmoji(type: string) {
  if (type.startsWith("TASK")) return "⚔️";
  if (type === "BADGE_UNLOCKED") return "🏅";
  if (type === "STREAK_TITLE") return "🔥";
  if (type === "MONSTER_EVOLVED") return "✨";
  if (type === "MONSTER_REBORN") return "🥚";
  return "📢";
}

export default function ParentGatheringPage() {
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [group, setGroup] = useState<GroupInfo | null | undefined>(undefined);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);

  // 子供一覧を取得
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
        if (kids.length > 0) setSelectedChildId(kids[0].id);
        else setLoading(false);
      });
  }, []);

  // 子供が変わったらグループ・ログを取得
  useEffect(() => {
    if (!selectedChildId) return;
    setLoading(true);
    setGroup(undefined);
    setLogs([]);

    // 既存チャンネルを解除
    if (channelRef.current) {
      const supabase = createClient();
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    (async () => {
      const res = await fetch(`/api/gathering/current?childId=${selectedChildId}`);
      const g: GroupInfo | null = res.ok ? await res.json() : null;
      setGroup(g);

      if (g) {
        const logsRes = await fetch(`/api/gathering/board?childId=${selectedChildId}`);
        if (logsRes.ok) setLogs(await logsRes.json());

        // Realtime 購読
        const supabase = createClient();
        const channel = supabase
          .channel(`parent-bulletin-${g.groupId}`)
          .on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "BulletinLog", filter: `groupId=eq.${g.groupId}` },
            (payload) => { setLogs((prev) => [payload.new as LogEntry, ...prev]); },
          )
          .subscribe();
        channelRef.current = channel;
      }
      setLoading(false);
    })();

    return () => {
      if (channelRef.current) {
        const supabase = createClient();
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [selectedChildId]);

  return (
    <div className="max-w-md mx-auto px-4 pt-6 pb-24">
      <h1 className="text-xl font-bold mb-4">🏕️ あつまり（親の確認）</h1>

      {/* 子供セレクター */}
      {children.length > 1 && (
        <div className="flex gap-2 mb-4 flex-wrap">
          {children.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedChildId(c.id)}
              className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                selectedChildId === c.id
                  ? "border-quest-gold bg-quest-gold/10 text-quest-gold"
                  : "border-quest-border text-quest-dim hover:border-quest-gold/50"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      {loading && <div className="flex justify-center py-10"><LoadingSpinner /></div>}

      {!loading && group === null && (
        <div className="bg-quest-card border border-quest-border rounded-xl p-6 text-center text-quest-dim">
          <p className="text-3xl mb-2">💤</p>
          <p className="text-sm">いまはどこにも集まっていません</p>
        </div>
      )}

      {!loading && group && (
        <>
          {/* グループ情報 */}
          <div className="bg-quest-card border border-quest-border rounded-xl p-4 mb-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{LOCATION_EMOJI[group.location]}</span>
              <div>
                <p className="font-bold">{LOCATION_LABEL[group.location]}</p>
                <p className="text-xs text-quest-dim">
                  合言葉: <span className="text-quest-gold font-mono">{group.secretWord}</span>
                </p>
                <p className="text-xs text-quest-dim">
                  {group.memberCount}/{LOCATION_CAPACITY[group.location]}人 参加中
                </p>
              </div>
            </div>
          </div>

          {/* なかま一覧 */}
          <GatheringMemberList members={group.members} />

          {/* 掲示板 */}
          <div className="bg-quest-card border border-quest-border rounded-xl p-4">
            <h2 className="text-sm font-bold mb-3 text-quest-dim">📋 けいじばん</h2>
            {logs.length === 0 ? (
              <p className="text-quest-dim/60 text-xs text-center py-6">まだログはありません</p>
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
        </>
      )}
    </div>
  );
}
