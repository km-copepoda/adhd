"use client";

import { useEffect, useState } from "react";
import LoadingSpinner from "@/components/LoadingSpinner";
import { LOCATION_LABEL, LOCATION_EMOJI, LOCATION_CAPACITY, normalizeSecretWord, type GatheringLocationType } from "@/lib/gathering";
import GatheringMemberList from "@/components/GatheringMemberList";
import GatheringBoard from "@/components/GatheringBoard";
import GatheringStampPanel from "@/components/child/GatheringStampPanel";

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

const LOCATIONS: GatheringLocationType[] = ["PARK", "COMMUNITY_CENTER", "SCHOOL"];

export default function GatheringPage() {
  const [group, setGroup] = useState<GroupInfo | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 参加フォーム
  const [selectedLocation, setSelectedLocation] = useState<GatheringLocationType>("PARK");
  const [secretWord, setSecretWord] = useState("");

  async function fetchGroup() {
    const res = await fetch("/api/gathering/current");
    const data = res.ok ? await res.json() : null;
    setGroup(data);
    return data as GroupInfo | null;
  }

  useEffect(() => {
    (async () => {
      await fetchGroup();
      setLoading(false);
    })();
  }, []);

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
      await fetchGroup();
    } finally {
      setJoining(false);
    }
  }

  async function handleLeave() {
    setLeaving(true);
    try {
      await fetch("/api/gathering/leave", { method: "POST" });
      setGroup(null);
    } finally {
      setLeaving(false);
    }
  }

  if (loading) return <div className="flex justify-center items-center min-h-screen"><LoadingSpinner /></div>;

  return (
    <div className="min-h-screen bg-quest-bg text-quest-text pb-24">
      <div className="max-w-md mx-auto px-4 pt-6">
        <h1 className="text-xl font-bold mb-4">🏕️ ギルド</h1>

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

            {/* エールを送る */}
            <GatheringStampPanel
              groupId={group.groupId}
              members={group.members.map((m) => ({ id: m.id, monsterName: m.monsterName, isMe: m.isMe }))}
            />

            {/* 掲示板（日付タブ付き） */}
            <GatheringBoard groupId={group.groupId} />
          </>
        )}
      </div>
    </div>
  );
}
