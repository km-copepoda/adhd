"use client";

import { useEffect, useState } from "react";
import LoadingSpinner from "@/components/LoadingSpinner";
import type { GatheringLocationType } from "@/lib/gathering";
import { LOCATION_LABEL, LOCATION_EMOJI, LOCATION_CAPACITY } from "@/lib/gathering";
import GatheringMemberList from "@/components/GatheringMemberList";
import GatheringBoard from "@/components/GatheringBoard";

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

export default function ParentGatheringPage() {
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [group, setGroup] = useState<GroupInfo | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);

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

  // 子供が変わったらグループを取得
  useEffect(() => {
    if (!selectedChildId) return;
    setLoading(true);
    setGroup(undefined);

    (async () => {
      const res = await fetch(`/api/gathering/current?childId=${selectedChildId}`);
      const g: GroupInfo | null = res.ok ? await res.json() : null;
      setGroup(g);
      setLoading(false);
    })();
  }, [selectedChildId]);

  return (
    <div className="max-w-md mx-auto px-4 pt-6 pb-24">
      <h1 className="text-xl font-bold mb-4">🏕️ ひろば（親の確認）</h1>

      {/* 子供セレクター（2人以上の場合のみ表示） */}
      {children.length > 1 && (
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {children.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedChildId(c.id)}
              className={[
                "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs whitespace-nowrap transition-colors",
                selectedChildId === c.id
                  ? "bg-quest-gold/15 border border-quest-gold text-quest-gold"
                  : "bg-quest-card border border-quest-border text-quest-dim hover:text-quest-text",
              ].join(" ")}
            >
              🧒 {c.monsterName || c.name}
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

      {!loading && group && selectedChildId && (
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

          {/* 掲示板（日付タブ付き） */}
          <GatheringBoard groupId={group.groupId} childId={selectedChildId} />
        </>
      )}
    </div>
  );
}
