"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import LoadingSpinner from "@/components/LoadingSpinner";
import type { GatheringLocationType } from "@/lib/gathering";
import { LOCATION_LABEL, LOCATION_EMOJI, LOCATION_CAPACITY } from "@/lib/gathering";
import GatheringMemberList from "@/components/GatheringMemberList";
import GatheringBoard from "@/components/GatheringBoard";

type Member = {
  id: string;
  monsterName: string;
  speciesName: string;
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

export default function ChildViewGatheringPage() {
  const params = useParams<{ childId: string }>();
  const childId = params.childId;
  const [group, setGroup] = useState<GroupInfo | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!childId) return;
    setLoading(true);
    setGroup(undefined);
    (async () => {
      try {
        const res = await fetch(`/api/gathering/current?childId=${childId}`);
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          setError(d.error ?? `読み込みに失敗しました（${res.status}）`);
          setGroup(null);
        } else {
          const g: GroupInfo | null = await res.json();
          setGroup(g);
        }
      } catch {
        setError("読み込みに失敗しました");
        setGroup(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [childId]);

  return (
    <div className="px-4 pt-6">
      <h1 className="text-lg font-serif text-quest-gold tracking-wider mb-1">
        🏕️ ひろば（代理閲覧）
      </h1>
      <p className="text-quest-dim text-xs mb-4">
        親モードでは閲覧のみ。エール送信・グループ参加は子供画面から行ってください。
      </p>

      {error && (
        <div className="mb-4 bg-red-400/10 border border-red-400/30 rounded-xl px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-10">
          <LoadingSpinner />
        </div>
      )}

      {!loading && group === null && (
        <div className="bg-quest-card border border-quest-border rounded-xl p-6 text-center text-quest-dim">
          <p className="text-3xl mb-2">💤</p>
          <p className="text-sm">いまはどこにも集まっていません</p>
        </div>
      )}

      {!loading && group && (
        <>
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

          <GatheringMemberList members={group.members} />

          <GatheringBoard groupId={group.groupId} childId={childId} />
        </>
      )}
    </div>
  );
}
