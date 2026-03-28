"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { getMonsterStage, getXpInfo, CATEGORY_LABEL, CATEGORY_COLOR, STREAK_MILESTONES, MONSTER_TABLE, REBIRTH_THRESHOLD } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import LoadingSpinner from "@/components/LoadingSpinner";

type MonsterData = {
  name: string;
  side: string | null;
  evolutionStage: number;
  evolutionPath: string;
  collectedPaths: string;
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
  const [reborn, setReborn] = useState(false);
  const prevStageRef = useRef<number | null>(null);

  const fetchStatus = () =>
    fetch("/api/monster-status").then((r) => r.json());

  useEffect(() => {
    fetchStatus()
      .then((d) => {
        setData({
          name: d.name, side: d.side ?? null, evolutionStage: d.evolutionStage, evolutionPath: d.evolutionPath ?? "",
          collectedPaths: d.collectedPaths ?? "[]",
          studyPt: d.studyPt, staminaPt: d.staminaPt, lifePt: d.lifePt,
          pendingStudyPt: d.pendingStudyPt, pendingStaminaPt: d.pendingStaminaPt, pendingLifePt: d.pendingLifePt,
        });
        setStreak({
          currentStreak: d.currentStreak, bestStreak: d.bestStreak,
          monthlyDays: d.monthlyDays, lastAchievedDate: d.lastAchievedDate, currentTitle: d.currentTitle,
        });
        prevStageRef.current = d.evolutionStage;
        // 育成画面以外で進化が起きた場合: 最後に確認したステージと比較して進化演出を表示
        const lastSeen = parseInt(localStorage.getItem("lastSeenEvolutionStage") ?? "-1");
        const hasEverEvolved = (JSON.parse(d.collectedPaths ?? "[]") as string[]).length > 0;
        if (d.evolutionStage === 0 && lastSeen >= 3 && hasEverEvolved) {
          setReborn(true);
        } else if (d.evolutionStage > lastSeen) {
          if (d.evolutionStage === 1) {
            setHatched(true);
          } else if (d.evolutionStage > 1) {
            setShowEvolution(true);
          }
        }
        localStorage.setItem("lastSeenEvolutionStage", String(d.evolutionStage));
      })
      .finally(() => setLoading(false));

    const supabase = createClient();
    const channel = supabase
      .channel("monster-changes")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "User" }, () => {
        fetchStatus().then((d) => {
          if (prevStageRef.current !== null) {
            if (d.evolutionStage === 0 && prevStageRef.current >= 3) {
              setReborn(true);
              localStorage.setItem("lastSeenEvolutionStage", String(d.evolutionStage));
            } else if (d.evolutionStage > prevStageRef.current) {
              if (prevStageRef.current === 0) {
                setHatched(true);
              } else {
                setShowEvolution(true);
              }
              localStorage.setItem("lastSeenEvolutionStage", String(d.evolutionStage));
            }
          }
          prevStageRef.current = d.evolutionStage;
          setData({
            name: d.name, side: d.side ?? null, evolutionStage: d.evolutionStage, evolutionPath: d.evolutionPath ?? "",
            collectedPaths: d.collectedPaths ?? "[]",
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
  const xpInfo = getXpInfo(data.evolutionStage, data.evolutionPath, data.studyPt, data.staminaPt, data.lifePt);
  const monster = getMonsterStage(data.evolutionStage, data.evolutionPath, data.side);
  const total = data.studyPt + data.staminaPt + data.lifePt;

  const params = [
    { key: "STUDY" as const, value: data.studyPt, pending: data.pendingStudyPt },
    { key: "STAMINA" as const, value: data.staminaPt, pending: data.pendingStaminaPt },
    { key: "LIFE" as const, value: data.lifePt, pending: data.pendingLifePt },
  ];

  return (
    <div className="px-4 pt-6">
      {/* Evolution cut-in overlay */}
      {showEvolution && data && (() => {
        const m = getMonsterStage(data.evolutionStage, data.evolutionPath, data.side);
        const desc = MONSTER_TABLE[data.evolutionPath]?.description;
        return (
          <div
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 px-6"
            onClick={() => setShowEvolution(false)}
            style={{ animation: "fadeIn 0.3s ease-out" }}
          >
            <div style={{ animation: "evolveIn 0.5s ease-out" }}>
              <div className="w-80 h-80 mb-6 mx-auto" style={{ filter: "drop-shadow(0 0 40px rgba(251,191,36,0.8))", animation: "pulse 0.8s ease-in-out infinite alternate" }}>
                {"image" in m ? <Image src={m.image} alt={m.name} width={320} height={320} className="w-full h-full object-contain" /> : <span className="text-9xl">{m.emoji}</span>}
              </div>
            </div>
            <p className="font-serif text-quest-gold text-3xl tracking-widest mb-1" style={{ animation: "evolveIn 0.6s ease-out", textShadow: "0 0 20px rgba(251,191,36,0.8)" }}>
              進化した！
            </p>
            <p className="text-quest-gold/70 text-lg mb-4">{m.name}</p>
            {desc && (
              <p className="text-quest-dim/80 text-xs text-center leading-relaxed mb-6 max-w-xs" style={{ animation: "evolveIn 0.7s ease-out" }}>
                {desc}
              </p>
            )}
            <p className="text-quest-dim text-xs">タップして閉じる</p>
            <style>{`
              @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
              @keyframes evolveIn { from { opacity: 0; transform: scale(0.3) } to { opacity: 1; transform: scale(1) } }
              @keyframes pulse { from { transform: scale(1) } to { transform: scale(1.1) } }
            `}</style>
          </div>
        );
      })()}

      {/* Hatch cut-in overlay (egg → first form) */}
      {hatched && data && (() => {
        const m = getMonsterStage(data.evolutionStage, data.evolutionPath, data.side);
        const desc = MONSTER_TABLE[data.evolutionPath]?.description;
        return (
          <div
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 px-6"
            onClick={() => setHatched(false)}
            style={{ animation: "fadeIn 0.3s ease-out" }}
          >
            <div style={{ animation: "evolveIn 0.5s ease-out" }}>
              <div className="w-80 h-80 mb-6 mx-auto" style={{ filter: "drop-shadow(0 0 40px rgba(251,191,36,0.8))", animation: "pulse 0.8s ease-in-out infinite alternate" }}>
                {"image" in m ? <Image src={m.image} alt={m.name} width={320} height={320} className="w-full h-full object-contain" /> : <span className="text-9xl">{m.emoji}</span>}
              </div>
            </div>
            <p className="font-serif text-quest-gold text-3xl tracking-widest mb-1" style={{ animation: "evolveIn 0.6s ease-out", textShadow: "0 0 20px rgba(251,191,36,0.8)" }}>
              うまれた！
            </p>
            <p className="text-quest-gold/70 text-lg mb-4">{m.name}</p>
            {desc && (
              <p className="text-quest-dim/80 text-xs text-center leading-relaxed mb-6 max-w-xs" style={{ animation: "evolveIn 0.7s ease-out" }}>
                {desc}
              </p>
            )}
            <p className="text-quest-dim text-xs">タップして閉じる</p>
            <style>{`
              @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
              @keyframes evolveIn { from { opacity: 0; transform: scale(0.3) } to { opacity: 1; transform: scale(1) } }
              @keyframes pulse { from { transform: scale(1) } to { transform: scale(1.1) } }
            `}</style>
          </div>
        );
      })()}

      {/* Rebirth cut-in overlay */}
      {reborn && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90"
          onClick={() => setReborn(false)}
          style={{ animation: "fadeIn 0.3s ease-out" }}
        >
          <div style={{ animation: "evolveIn 0.5s ease-out" }}>
            <div className="w-80 h-80 mb-6 mx-auto" style={{ filter: "drop-shadow(0 0 40px rgba(139,92,246,0.8))", animation: "pulse 0.8s ease-in-out infinite alternate" }}>
              <span className="text-9xl flex items-center justify-center w-full h-full">🥚</span>
            </div>
          </div>
          <p className="font-serif text-purple-400 text-3xl tracking-widest mb-2" style={{ animation: "evolveIn 0.6s ease-out", textShadow: "0 0 20px rgba(139,92,246,0.8)" }}>
            転生！
          </p>
          <p className="text-purple-400/70 text-lg mb-8">新たな冒険がはじまる…</p>
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
        <div className="w-56 h-56 animate-float mb-4 mx-auto" style={{ filter: "drop-shadow(0 0 20px rgba(139,92,246,0.3))" }}>
          {"image" in monster ? <Image src={monster.image} alt={monster.name} width={224} height={224} className="w-full h-full object-contain" /> : <span className="text-7xl">{monster.emoji}</span>}
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
        {xpInfo.xpToEvolve === null && (() => {
          const rebirthPct = Math.min(100, (total / REBIRTH_THRESHOLD) * 100);
          const rebirthPending = Math.min(100 - rebirthPct, (pendingTotal / REBIRTH_THRESHOLD) * 100);
          return (
            <div className="w-48 mt-4">
              <div className="flex justify-between text-[10px] text-quest-dim mb-1">
                <span>
                  {total} / {REBIRTH_THRESHOLD} pt
                  {pendingTotal > 0 && <span className="ml-1">+ {pendingTotal} pt(仮)</span>}
                </span>
                <span>転生まで</span>
              </div>
              <div className="h-1.5 bg-quest-border rounded-full overflow-hidden flex">
                <div
                  className="h-full bg-gradient-to-r from-purple-700 to-purple-400 rounded-l-full animate-shimmer"
                  style={{ width: `${rebirthPct}%` }}
                />
                {rebirthPending > 0 && (
                  <div
                    className="h-full"
                    style={{
                      width: `${rebirthPending}%`,
                      background: "rgba(139,92,246,0.25)",
                      borderLeft: "1px dashed rgba(139,92,246,0.5)",
                    }}
                  />
                )}
              </div>
              <p className="text-quest-gold text-[10px] mt-1 text-center">最終形態</p>
            </div>
          );
        })()}
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

      {/* Next evolution hint: probabilistic weights */}
      {xpInfo.evolutionWeights && xpInfo.ptNeeded !== null && (
        <div className="mt-4 bg-quest-card/50 border border-quest-border rounded-xl p-4">
          <p className="text-quest-dim text-xs mb-2 text-center">
            次の進化 · あと {Math.max(0, xpInfo.ptNeeded)} pt
          </p>
          <div className="flex gap-2">
            {(["STUDY", "STAMINA", "LIFE"] as const).map((path) => (
              <div key={path} className="flex-1 text-center">
                <p className="text-xs" style={{ color: CATEGORY_COLOR[path] }}>
                  {CATEGORY_LABEL[path].emoji} {CATEGORY_LABEL[path].name}
                </p>
                <p className="text-quest-gold font-bold text-sm">
                  {Math.round(xpInfo.evolutionWeights![path] * 100)}%
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
