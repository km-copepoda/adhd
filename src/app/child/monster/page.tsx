"use client";

import { useEffect, useRef, useState } from "react";
import { getMonsterStage, getXpInfo, CATEGORY_LABEL, CATEGORY_COLOR, STREAK_MILESTONES } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import type { Side } from "@/types";
import LoadingSpinner from "@/components/LoadingSpinner";

type MonsterData = {
  name: string;
  side: Side;
  evolutionStage: number;
  studyPt: number;
  staminaPt: number;
  lifePt: number;
  pendingStudyPt: number;
  pendingStaminaPt: number;
  pendingLifePt: number;
};

type StreakData = {
  currentStreak: number;
  bestStreak: number;
  monthlyDays: number;
  lastAchievedDate: string | null;
  currentTitle: { title: string; emoji: string } | null;
};

export default function MonsterPage() {
  const [data, setData] = useState<MonsterData | null>(null);
  const [streak, setStreak] = useState<StreakData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEvolution, setShowEvolution] = useState(false);
  const [hatched, setHatched] = useState(false);
  const prevStageRef = useRef<number | null>(null);

  const fetchStatus = () =>
    fetch("/api/monster-status").then((r) => r.json());

  useEffect(() => {
    fetchStatus()
      .then((d) => {
        setData({
          name: d.name, side: d.side, evolutionStage: d.evolutionStage,
          studyPt: d.studyPt, staminaPt: d.staminaPt, lifePt: d.lifePt,
          pendingStudyPt: d.pendingStudyPt, pendingStaminaPt: d.pendingStaminaPt, pendingLifePt: d.pendingLifePt,
        });
        setStreak({
          currentStreak: d.currentStreak, bestStreak: d.bestStreak,
          monthlyDays: d.monthlyDays, lastAchievedDate: d.lastAchievedDate, currentTitle: d.currentTitle,
        });
        prevStageRef.current = d.evolutionStage;
        if (sessionStorage.getItem("pendingEvolution") === "true") {
          sessionStorage.removeItem("pendingEvolution");
          if (d.evolutionStage === 1) {
            setHatched(true);
            setTimeout(() => setHatched(false), 3000);
          } else {
            setShowEvolution(true);
            setTimeout(() => setShowEvolution(false), 3000);
          }
        }
      })
      .finally(() => setLoading(false));

    const supabase = createClient();
    const channel = supabase
      .channel("monster-changes")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "User" }, () => {
        fetchStatus().then((d) => {
          if (prevStageRef.current !== null && d.evolutionStage > prevStageRef.current) {
            if (prevStageRef.current === 0) {
              setHatched(true);
              setTimeout(() => setHatched(false), 3000);
            } else {
              setShowEvolution(true);
              setTimeout(() => setShowEvolution(false), 3000);
            }
          }
          prevStageRef.current = d.evolutionStage;
          setData({
            name: d.name, side: d.side, evolutionStage: d.evolutionStage,
            studyPt: d.studyPt, staminaPt: d.staminaPt, lifePt: d.lifePt,
            pendingStudyPt: d.pendingStudyPt, pendingStaminaPt: d.pendingStaminaPt, pendingLifePt: d.pendingLifePt,
          });
          setStreak({
            currentStreak: d.currentStreak, bestStreak: d.bestStreak,
            monthlyDays: d.monthlyDays, lastAchievedDate: d.lastAchievedDate, currentTitle: d.currentTitle,
          });
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading || !data) {
    return (
      <LoadingSpinner />
    );
  }

  const pendingTotal = data.pendingStudyPt + data.pendingStaminaPt + data.pendingLifePt;
  const xpInfo = getXpInfo(data.side, data.evolutionStage, data.studyPt, data.staminaPt, data.lifePt);
  const monster = getMonsterStage(data.side, data.evolutionStage);
  const total = data.studyPt + data.staminaPt + data.lifePt;

  const params = [
    { key: "STUDY" as const, value: data.studyPt, pending: data.pendingStudyPt },
    { key: "STAMINA" as const, value: data.staminaPt, pending: data.pendingStaminaPt },
    { key: "LIFE" as const, value: data.lifePt, pending: data.pendingLifePt },
  ];

  return (
    <div className="px-4 pt-6">
      {/* Evolution cut-in overlay */}
      {showEvolution && data && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 animate-fade-in"
          onClick={() => setShowEvolution(false)}
          style={{ animation: "fadeIn 0.3s ease-out" }}
        >
          <div style={{ animation: "evolveIn 0.5s ease-out" }}>
            <div className="text-9xl mb-6" style={{ filter: "drop-shadow(0 0 40px rgba(251,191,36,0.8))", animation: "pulse 0.8s ease-in-out infinite alternate" }}>
              {getMonsterStage(data.side, data.evolutionStage).emoji}
            </div>
          </div>
          <p className="font-serif text-quest-gold text-3xl tracking-widest mb-2" style={{ animation: "evolveIn 0.6s ease-out", textShadow: "0 0 20px rgba(251,191,36,0.8)" }}>
            進化した！
          </p>
          <p className="text-quest-gold/70 text-lg mb-8">
            {getMonsterStage(data.side, data.evolutionStage).name}
          </p>
          <p className="text-quest-dim text-xs">タップして閉じる</p>
          <style>{`
            @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
            @keyframes evolveIn { from { opacity: 0; transform: scale(0.3) } to { opacity: 1; transform: scale(1) } }
            @keyframes pulse { from { transform: scale(1) } to { transform: scale(1.1) } }
          `}</style>
        </div>
      )}

      {/* Hatch cut-in overlay (egg → first form) */}
      {hatched && data && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 animate-fade-in"
          onClick={() => setHatched(false)}
          style={{ animation: "fadeIn 0.3s ease-out" }}
        >
          <div style={{ animation: "evolveIn 0.5s ease-out" }}>
            <div className="text-9xl mb-6" style={{ filter: "drop-shadow(0 0 40px rgba(251,191,36,0.8))", animation: "pulse 0.8s ease-in-out infinite alternate" }}>
              {getMonsterStage(data.side, data.evolutionStage).emoji}
            </div>
          </div>
          <p className="font-serif text-quest-gold text-3xl tracking-widest mb-2" style={{ animation: "evolveIn 0.6s ease-out", textShadow: "0 0 20px rgba(251,191,36,0.8)" }}>
            うまれた！
          </p>
          <p className="text-quest-gold/70 text-lg mb-8">
            {getMonsterStage(data.side, data.evolutionStage).name}
          </p>
          <p className="text-quest-dim text-xs">タップして閉じる</p>
          <style>{`
            @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
            @keyframes evolveIn { from { opacity: 0; transform: scale(0.3) } to { opacity: 1; transform: scale(1) } }
            @keyframes pulse { from { transform: scale(1) } to { transform: scale(1.1) } }
          `}</style>
        </div>
      )}

      {/* Monster hero */}
      <div className="flex flex-col items-center py-8 mb-6 rounded-2xl bg-gradient-to-b from-purple-950/30 to-transparent">
        <div className="text-7xl animate-float mb-4" style={{ filter: "drop-shadow(0 0 20px rgba(139,92,246,0.3))" }}>
          {monster.emoji}
        </div>
        <p className="font-serif text-quest-gold text-xl tracking-wider">
          {data.name}
        </p>
        <p className="text-quest-dim text-xs mt-1">
          {monster.name}
        </p>

        {/* XP bar (progress toward next evolution) */}
        {xpInfo.xpToEvolve !== null && (() => {
          const approvedPct = Math.min(100, (total / xpInfo.xpToEvolve) * 100);
          const pendingPct = Math.min(100 - approvedPct, (pendingTotal / xpInfo.xpToEvolve) * 100);
          return (
            <div className="w-48 mt-4">
              <div className="flex justify-between text-[10px] text-quest-dim mb-1">
                <span>
                  {total} / {xpInfo.xpToEvolve} pt
                  {pendingTotal > 0 && <span className="ml-1">+ {pendingTotal} pt(仮)</span>}
                </span>
                <span>進化まで</span>
              </div>
              <div className="h-1.5 bg-quest-border rounded-full overflow-hidden flex">
                <div
                  className="h-full bg-gradient-to-r from-quest-gold-dark to-quest-gold rounded-l-full animate-shimmer"
                  style={{ width: `${approvedPct}%` }}
                />
                {pendingPct > 0 && (
                  <div
                    className="h-full"
                    style={{
                      width: `${pendingPct}%`,
                      background: "rgba(251,191,36,0.25)",
                      borderLeft: "1px dashed rgba(251,191,36,0.5)",
                    }}
                  />
                )}
              </div>
            </div>
          );
        })()}
        {xpInfo.xpToEvolve === null && (
          <p className="text-quest-gold text-xs mt-3">最終形態</p>
        )}
      </div>

      {/* Streak card */}
      {streak && (
        <div className="bg-quest-card border border-quest-border rounded-xl p-4 mb-4 relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-orange-500" />
          <div className="pl-2">
            {/* 称号 */}
            {streak.currentTitle && (
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-lg">{streak.currentTitle.emoji}</span>
                <span className="text-xs text-quest-gold tracking-wider">{streak.currentTitle.title}</span>
              </div>
            )}
            {/* ストリーク数値 */}
            <div className="flex items-baseline gap-1 mb-3">
              <span className="text-2xl font-bold text-orange-400">{streak.currentStreak}</span>
              <span className="text-xs text-quest-dim">日連続</span>
            </div>
            {/* 統計 */}
            <div className="flex gap-4 text-xs">
              <div>
                <span className="text-quest-dim">今月</span>
                <span className="ml-1 text-quest-text font-medium">{streak.monthlyDays}日</span>
              </div>
              <div>
                <span className="text-quest-dim">最高</span>
                <span className="ml-1 text-quest-text font-medium">{streak.bestStreak}日</span>
              </div>
            </div>
            {/* 次のマイルストーン */}
            {(() => {
              const next = STREAK_MILESTONES.find((m) => m.days > streak.currentStreak);
              if (!next) return null;
              return (
                <div className="mt-3 flex items-center gap-2 text-xs text-quest-dim">
                  <span>{next.emoji}</span>
                  <span>あと{next.days - streak.currentStreak}日で「{next.title}」</span>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Total points */}
      <div className="bg-quest-card border border-quest-border rounded-xl p-4 mb-4">
        <div className="flex justify-between items-center">
          <span className="text-quest-dim text-xs tracking-wider">合計ポイント</span>
          <span className="text-quest-gold font-bold text-lg">{total} pt</span>
        </div>
      </div>

      {/* Parameter cards */}
      <div className="flex flex-col gap-3">
        {params.map((p) => {
          const label = CATEGORY_LABEL[p.key];
          const color = CATEGORY_COLOR[p.key];
          const approvedPct = xpInfo.xpToEvolve !== null
            ? Math.min(100, Math.round((p.value / xpInfo.xpToEvolve) * 100))
            : 100;
          const pendingPct = xpInfo.xpToEvolve !== null
            ? Math.min(100 - approvedPct, Math.round((p.pending / xpInfo.xpToEvolve) * 100))
            : 0;

          return (
            <div
              key={p.key}
              className="bg-quest-card border border-quest-border rounded-xl p-4 relative overflow-hidden"
            >
              {/* Left color stripe */}
              <div
                className="absolute left-0 top-0 bottom-0 w-1"
                style={{ backgroundColor: color }}
              />
              <div className="flex items-center gap-3 pl-2">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-lg"
                  style={{ backgroundColor: `${color}15` }}
                >
                  {label.emoji}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-baseline">
                    <span className="text-sm">{label.name}</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-lg font-bold" style={{ color }}>
                        {p.value} <span className="text-xs font-normal text-quest-dim">pt</span>
                      </span>
                      {p.pending > 0 && (
                        <span className="text-xs text-quest-dim">+ {p.pending} pt(仮)</span>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 h-1.5 bg-quest-border rounded-full overflow-hidden flex">
                    {/* 承認済みポイント */}
                    <div
                      className="h-full rounded-l-full transition-all animate-shimmer"
                      style={{
                        width: `${approvedPct}%`,
                        background: `linear-gradient(90deg, ${color}80, ${color})`,
                      }}
                    />
                    {/* 仮ポイント（薄い色） */}
                    {pendingPct > 0 && (
                      <div
                        className="h-full transition-all"
                        style={{
                          width: `${pendingPct}%`,
                          background: `${color}40`,
                          borderLeft: `1px dashed ${color}80`,
                        }}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Next evolution hint */}
      {xpInfo.nextEvolution && (
        <div className="mt-4 bg-quest-card/50 border border-quest-border rounded-xl p-4 text-center">
          <p className="text-quest-dim text-xs mb-1">次の進化</p>
          <p className="text-quest-gold">
            <span className="text-2xl">{xpInfo.nextEvolution.emoji}</span>
            <span className="text-sm ml-2">
              {xpInfo.nextEvolution.name} · あと {xpInfo.nextEvolution.ptNeeded} pt
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
