"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import LoadingSpinner from "@/components/LoadingSpinner";
import { getMonsterMiniData, type MonsterMiniData } from "@/lib/monster-mini";
import { REBIRTH_THRESHOLD } from "@/lib/evolution";

const REBIRTH_CONFIRM_MESSAGE =
  "代理で転生しますか？\n\n卵ボーナスなし（NORMAL卵）で転生します。\n勉強/体力/生活の卵を選びたい場合は子供画面から操作してください。";

type MonsterStatus = {
  name: string;
  side: "DARK" | "LIGHT" | null;
  evolutionStage: number;
  evolutionPath: string;
  collectedPaths: string;
  studyPt: number;
  staminaPt: number;
  lifePt: number;
  pendingStudyPt: number;
  pendingStaminaPt: number;
  pendingLifePt: number;
  rebirthPending: boolean;
  rebirthEggBonus: string | null;
  monsterSetId: string;
  currentStreak: number;
  bestStreak: number;
  monthlyDays: number;
  currentTitle: { title: string; emoji: string } | null;
};

export default function ChildViewMonsterPage() {
  const params = useParams<{ childId: string }>();
  const childId = params.childId;
  const [status, setStatus] = useState<MonsterStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rebirthing, setRebirthing] = useState(false);

  async function refreshStatus() {
    const r = await fetch(`/api/parent/child-view/monster-status?childId=${childId}`);
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      setError(d.error ?? `読み込みに失敗しました（${r.status}）`);
      return;
    }
    setStatus(await r.json());
  }

  useEffect(() => {
    if (!childId) return;
    refreshStatus().catch(() => setError("読み込みに失敗しました"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childId]);

  async function handleRebirth() {
    if (!confirm(REBIRTH_CONFIRM_MESSAGE)) return;
    setRebirthing(true);
    try {
      const res = await fetch(`/api/parent/child-view/rebirth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ childId }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? `転生に失敗しました（${res.status}）`);
        return;
      }
      await refreshStatus();
    } finally {
      setRebirthing(false);
    }
  }

  if (error) return <p className="p-6 text-red-400 text-sm">{error}</p>;
  if (!status) return <LoadingSpinner />;

  const mini: MonsterMiniData = getMonsterMiniData({
    evolutionStage: status.evolutionStage,
    evolutionPath: status.evolutionPath,
    side: status.side ?? null,
    studyPt: status.studyPt,
    staminaPt: status.staminaPt,
    lifePt: status.lifePt,
    collectedPaths: status.collectedPaths,
    rebirthEggBonus: status.rebirthEggBonus,
    monsterSetId: status.monsterSetId,
  });

  const progressPct = mini.isRebirth
    ? Math.min(100, (mini.ptCurrent / mini.rebirthThreshold) * 100)
    : mini.ptToEvolve !== null
    ? Math.min(100, (mini.ptCurrent / mini.ptToEvolve) * 100)
    : 100;

  return (
    <div className="px-4 pt-6">
      <h1 className="font-serif text-quest-gold text-lg tracking-wider mb-1">
        🐣 {status.name}（代理閲覧）
      </h1>
      <p className="text-quest-dim text-xs mb-4">
        親モードでは閲覧のみ（転生待ちのときだけ NORMAL 卵での代理転生が可能）。
        勉強/体力/生活の卵を選びたい場合は子供画面から操作してください。
      </p>

      {status.rebirthPending && (
        <div className="mb-4 bg-purple-500/10 border border-purple-400/30 rounded-xl p-4">
          <p className="text-sm font-bold text-purple-300 mb-1">転生待ちです</p>
          <p className="text-xs text-quest-dim mb-3">
            このままだと XP は加点されても進化が止まります。代理で転生すると NORMAL 卵
            （ボーナスなし）で次サイクルが始まります。
          </p>
          <button
            onClick={handleRebirth}
            disabled={rebirthing}
            className="w-full py-2 rounded-lg bg-purple-500/30 border border-purple-400/50 text-purple-100 text-sm font-bold hover:bg-purple-500/40 disabled:opacity-40"
          >
            {rebirthing ? "転生中..." : "🥚 代理で転生する（NORMAL 卵）"}
          </button>
        </div>
      )}

      <div className="bg-quest-card border border-quest-border rounded-xl p-4 mb-4">
        <div className="flex items-center gap-4">
          <div
            className="w-24 h-24 shrink-0 rounded-xl flex items-center justify-center overflow-hidden"
            style={{
              background: mini.isRebirth ? "rgba(139,92,246,0.1)" : "rgba(251,191,36,0.08)",
            }}
          >
            <Image
              src={mini.image}
              alt={mini.monsterName}
              width={96}
              height={96}
              className="w-full h-full object-contain"
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-bold">{mini.monsterName}</p>
            <p className="text-xs text-quest-dim mt-1">{mini.stageLabel}</p>
            {status.rebirthPending && (
              <span className="inline-block mt-2 text-[10px] text-purple-400 border border-purple-400/30 rounded px-1.5 py-0.5">
                転生待ち
              </span>
            )}
          </div>
        </div>

        <div className="mt-4">
          <div className="flex justify-between items-baseline text-xs mb-1">
            <span className="text-quest-dim">
              {mini.isRebirth ? "転生まで" : "次の進化まで"}
            </span>
            <span className="text-quest-gold font-bold">
              {mini.ptCurrent} / {mini.isRebirth ? REBIRTH_THRESHOLD : mini.ptToEvolve ?? "-"} pt
            </span>
          </div>
          <div className="h-2 bg-quest-border rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${progressPct}%`,
                background: mini.isRebirth
                  ? "linear-gradient(90deg, #7e22ce, #a855f7)"
                  : "linear-gradient(90deg, #b45309, #fbbf24)",
              }}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-quest-card border border-quest-border rounded-xl p-3 text-center">
          <p className="text-[10px] text-quest-dim">📚 STUDY</p>
          <p className="text-lg font-bold text-quest-gold mt-1">{status.studyPt}</p>
          {status.pendingStudyPt > 0 && (
            <p className="text-[9px] text-quest-gold/50">+{status.pendingStudyPt} 仮</p>
          )}
        </div>
        <div className="bg-quest-card border border-quest-border rounded-xl p-3 text-center">
          <p className="text-[10px] text-quest-dim">💪 STAMINA</p>
          <p className="text-lg font-bold text-quest-gold mt-1">{status.staminaPt}</p>
          {status.pendingStaminaPt > 0 && (
            <p className="text-[9px] text-quest-gold/50">+{status.pendingStaminaPt} 仮</p>
          )}
        </div>
        <div className="bg-quest-card border border-quest-border rounded-xl p-3 text-center">
          <p className="text-[10px] text-quest-dim">🌱 LIFE</p>
          <p className="text-lg font-bold text-quest-gold mt-1">{status.lifePt}</p>
          {status.pendingLifePt > 0 && (
            <p className="text-[9px] text-quest-gold/50">+{status.pendingLifePt} 仮</p>
          )}
        </div>
      </div>

      <div className="bg-quest-card border border-quest-border rounded-xl p-4">
        <p className="text-quest-dim text-xs mb-2">🔥 ストリーク</p>
        <div className="flex items-baseline gap-4">
          <div>
            <p className="text-2xl font-black text-quest-gold">{status.currentStreak}</p>
            <p className="text-[10px] text-quest-dim">連続達成日</p>
          </div>
          <div>
            <p className="text-base font-bold text-quest-dim">{status.bestStreak}</p>
            <p className="text-[10px] text-quest-dim">最高記録</p>
          </div>
          <div className="ml-auto">
            <p className="text-base font-bold text-quest-dim">{status.monthlyDays}</p>
            <p className="text-[10px] text-quest-dim">今月達成日</p>
          </div>
        </div>
        {status.currentTitle && (
          <p className="mt-3 text-xs text-quest-gold/80">
            {status.currentTitle.emoji} {status.currentTitle.title}
          </p>
        )}
      </div>
    </div>
  );
}
