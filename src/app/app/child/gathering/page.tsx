"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import LoadingSpinner from "@/components/LoadingSpinner";
import { LOCATION_LABEL, LOCATION_EMOJI, LOCATION_CAPACITY, normalizeSecretWord, type GatheringLocationType } from "@/lib/gathering";
import GatheringMemberList from "@/components/GatheringMemberList";

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

const LOCATIONS: GatheringLocationType[] = ["PARK", "COMMUNITY_CENTER", "SCHOOL"];

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

export default function GatheringPage() {
  const [group, setGroup] = useState<GroupInfo | null | undefined>(undefined);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 参加フォーム
  const [selectedLocation, setSelectedLocation] = useState<GatheringLocationType>("PARK");
  const [secretWord, setSecretWord] = useState("");

  const logsEndRef = useRef<HTMLDivElement>(null);

  async function fetchGroup() {
    const res = await fetch("/api/gathering/current");
    const data = res.ok ? await res.json() : null;
    setGroup(data);
    return data as GroupInfo | null;
  }

  async function fetchLogs() {
    const res = await fetch("/api/gathering/board");
    if (res.ok) setLogs(await res.json());
  }

  useEffect(() => {
    (async () => {
      const g = await fetchGroup();
      if (g) await fetchLogs();
      setLoading(false);
    })();
  }, []);

  // Supabase Realtime でログをリアルタイム更新
  useEffect(() => {
    if (!group) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`bulletin-${group.groupId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "BulletinLog", filter: `groupId=eq.${group.groupId}` },
        (payload) => {
          setLogs((prev) => [payload.new as LogEntry, ...prev]);
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [group?.groupId]);

  // ログ更新時に先頭にスクロール
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  async function handleJoin() {
    setError(null);
    const normalized = normalizeSecretWord(secretWord);
    if (!normalized) { setError("合言葉を入力してください"); return; }
    setJoining(true);
    try {
      const res = await fetch("/api/gathering/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location: selectedLocation, secretWord: normalized }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "参加できませんでした"); return; }
      const g = await fetchGroup();
      if (g) await fetchLogs();
    } finally {
      setJoining(false);
    }
  }

  async function handleLeave() {
    setLeaving(true);
    try {
      await fetch("/api/gathering/leave", { method: "POST" });
      setGroup(null);
      setLogs([]);
    } finally {
      setLeaving(false);
    }
  }

  if (loading) return <div className="flex justify-center items-center min-h-screen"><LoadingSpinner /></div>;

  return (
    <div className="min-h-screen bg-quest-bg text-quest-text pb-24">
      <div className="max-w-md mx-auto px-4 pt-6">
        <h1 className="text-xl font-bold mb-4">🏕️ あつまり</h1>

        {group === null && (
          /* 参加フォーム */
          <div className="bg-quest-card border border-quest-border rounded-xl p-5 space-y-4">
            <p className="text-sm text-quest-dim">場所と合言葉でなかまと集まろう！</p>

            {/* 場所選択 */}
            <div className="space-y-2">
              <label className="text-xs text-quest-dim font-medium">場所</label>
              <div className="grid grid-cols-3 gap-2">
                {LOCATIONS.map((loc) => (
                  <button
                    key={loc}
                    onClick={() => setSelectedLocation(loc)}
                    className={`flex flex-col items-center py-3 rounded-lg border text-sm transition-colors ${
                      selectedLocation === loc
                        ? "border-quest-gold bg-quest-gold/10 text-quest-gold"
                        : "border-quest-border text-quest-dim hover:border-quest-gold/50"
                    }`}
                  >
                    <span className="text-2xl">{LOCATION_EMOJI[loc]}</span>
                    <span className="mt-1 text-xs">{LOCATION_LABEL[loc]}</span>
                    <span className="text-[10px] text-quest-dim/60">{LOCATION_CAPACITY[loc]}人まで</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 合言葉 */}
            <div className="space-y-1">
              <label className="text-xs text-quest-dim font-medium">合言葉（10文字まで）</label>
              <input
                type="text"
                value={secretWord}
                onChange={(e) => setSecretWord(e.target.value)}
                maxLength={10}
                placeholder="れいんぼー"
                className="w-full bg-quest-bg border border-quest-border rounded-lg px-3 py-2 text-quest-text placeholder:text-quest-dim/40 focus:outline-none focus:border-quest-gold/60"
              />
              {secretWord && (
                <p className="text-[11px] text-quest-dim">
                  正規化後: <span className="text-quest-gold">{normalizeSecretWord(secretWord)}</span>
                </p>
              )}
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button
              onClick={handleJoin}
              disabled={joining}
              className="w-full py-3 bg-quest-gold text-quest-bg font-bold rounded-lg disabled:opacity-50"
            >
              {joining ? "さんかちゅう…" : "あつまる！"}
            </button>
          </div>
        )}

        {group && (
          /* 参加中 */
          <>
            {/* グループ情報 */}
            <div className="bg-quest-card border border-quest-border rounded-xl p-4 mb-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{group.locationEmoji}</span>
                  <div>
                    <p className="font-bold">{group.locationLabel}</p>
                    <p className="text-xs text-quest-dim">
                      合言葉: <span className="text-quest-gold font-mono">{group.secretWord}</span>
                    </p>
                  </div>
                </div>
                <p className="text-xs text-quest-dim mt-1">
                  {group.memberCount}/{group.capacity}人 あつまっている
                </p>
              </div>
              <button
                onClick={handleLeave}
                disabled={leaving}
                className="text-xs text-quest-dim border border-quest-border rounded-lg px-3 py-1.5 hover:text-red-400 hover:border-red-400/50 transition-colors disabled:opacity-50"
              >
                {leaving ? "…" : "ぬける"}
              </button>
            </div>

            {/* なかま一覧 */}
            <GatheringMemberList members={group.members} />

            {/* 掲示板 */}
            <div className="bg-quest-card border border-quest-border rounded-xl p-4">
              <h2 className="text-sm font-bold mb-3 text-quest-dim">📋 けいじばん</h2>
              {logs.length === 0 ? (
                <p className="text-quest-dim/60 text-xs text-center py-6">
                  まだ書き込みはないよ<br />クエストをこなすと自動でログが流れるよ！
                </p>
              ) : (
                <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                  <div ref={logsEndRef} />
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
    </div>
  );
}
