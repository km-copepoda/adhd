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
  rebirthPending: boolean;
  rebirthEggBonus: string | null;
};

type StreakData = {
  currentStreak: number;
  bestStreak: number;
  monthlyDays: number;
  lastAchievedDate: string | null;
  currentTitle: { title: string; emoji: string } | null;
};

const EGG_OPTIONS = [
  {
    type: "STUDY",
    name: "勉強の卵",
    img: "/monsters/egg-study.png",
    desc: "📚 学力の確率+20%",
    color: "#60a5fa",
  },
  {
    type: "STAMINA",
    name: "体力の卵",
    img: "/monsters/egg-stamina.png",
    desc: "💪 体力の確率+20%",
    color: "#f87171",
  },
  {
    type: "LIFE",
    name: "生活力の卵",
    img: "/monsters/egg-life.png",
    desc: "🌿 生活力の確率+20%",
    color: "#4ade80",
  },
] as const;

export default function MonsterPage() {
  const [data, setData] = useState<MonsterData | null>(null);
  const [streak, setStreak] = useState<StreakData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEvolution, setShowEvolution] = useState(false);
  const [hatched, setHatched] = useState(false);
  const [reborn, setReborn] = useState(false);
  const [showEggSelection, setShowEggSelection] = useState(false);
  const [rebirthLoading, setRebirthLoading] = useState(false);
  const prevStageRef = useRef<number | null>(null);
  const selfRebirthRef = useRef(false);

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
          rebirthPending: d.rebirthPending ?? false,
          rebirthEggBonus: d.rebirthEggBonus ?? null,
        });
        setStreak({
          currentStreak: d.currentStreak, bestStreak: d.bestStreak,
          monthlyDays: d.monthlyDays, lastAchievedDate: d.lastAchievedDate, currentTitle: d.currentTitle,
        });
        prevStageRef.current = d.evolutionStage;
        // 育成画面以外で進化が起きた場合: 最後に確認したステージと比較して進化演出を表示
        const lastSeen = parseInt(localStorage.getItem("lastSeenEvolutionStage") ?? "-1");
        if (d.evolutionStage > lastSeen && lastSeen !== -1) {
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
          if (!selfRebirthRef.current && prevStageRef.current !== null) {
            if (d.evolutionStage > prevStageRef.current) {
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
            rebirthPending: d.rebirthPending ?? false,
            rebirthEggBonus: d.rebirthEggBonus ?? null,
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

  const handleRebirth = async (eggType: string) => {
    setRebirthLoading(true);
    selfRebirthRef.current = true;
    try {
      const res = await fetch("/api/rebirth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eggType }),
      });
      if (res.ok) {
        const newData = await fetchStatus();
        setData({
          name: newData.name, side: newData.side ?? null,
          evolutionStage: newData.evolutionStage, evolutionPath: newData.evolutionPath ?? "",
          collectedPaths: newData.collectedPaths ?? "[]",
          studyPt: newData.studyPt, staminaPt: newData.staminaPt, lifePt: newData.lifePt,
          pendingStudyPt: newData.pendingStudyPt, pendingStaminaPt: newData.pendingStaminaPt, pendingLifePt: newData.pendingLifePt,
          rebirthPending: newData.rebirthPending ?? false,
          rebirthEggBonus: newData.rebirthEggBonus ?? null,
        });
        prevStageRef.current = 0;
        localStorage.setItem("lastSeenEvolutionStage", "0");
        setShowEggSelection(false);
        setReborn(true);
      }
    } finally {
      selfRebirthRef.current = false;
      setRebirthLoading(false);
    }
  };

  if (loading || !data) {
    return (
      <LoadingSpinner />
    );
  }

  const pendingTotal = data.pendingStudyPt + data.pendingStaminaPt + data.pendingLifePt;
  const isReborn = (JSON.parse(data.collectedPaths) as string[]).length > 0;
  const xpInfo = getXpInfo(data.evolutionStage, data.evolutionPath, data.studyPt, data.staminaPt, data.lifePt, isReborn);
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
                <Image src={m.image} alt={m.name} width={320} height={320} className="w-full h-full object-contain" />
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
                <Image src={m.image} alt={m.name} width={320} height={320} className="w-full h-full object-contain" />
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
              {data ? (() => { const egg = getMonsterStage(0, "", data.side); return "image" in egg ? <Image src={egg.image} alt="たまご" width={320} height={320} className="w-full h-full object-contain" /> : <span className="text-9xl flex items-center justify-center w-full h-full">🥚</span>; })() : <span className="text-9xl flex items-center justify-center w-full h-full">🥚</span>}
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

      {/* Egg selection overlay */}
      {showEggSelection && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center px-4"
          style={{ animation: "fadeIn 0.3s ease-out" }}
        >
          <p className="font-serif text-purple-400 text-2xl tracking-widest mb-2">卵を選ぼう</p>
          <p className="text-quest-dim text-sm mb-8 text-center">
            次回転生まで、選んだカテゴリの<br />進化確率が<span className="text-purple-400 font-bold">+20%</span>アップ！
          </p>
          <div className="flex flex-col gap-3 w-full max-w-sm">
            {EGG_OPTIONS.map(({ type, name, img, desc, color }) => (
              <button
                key={type}
                onClick={() => handleRebirth(type)}
                disabled={rebirthLoading}
                className="bg-quest-card border border-quest-border rounded-xl p-4 flex items-center gap-4 active:scale-95 transition-transform disabled:opacity-50"
                style={{ borderColor: rebirthLoading ? undefined : `${color}40` }}
              >
                <div className="w-16 h-16 flex-shrink-0">
                  <Image src={img} alt={name} width={64} height={64} className="w-full h-full object-contain" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-bold text-quest-text text-base">{name}</p>
                  <p className="text-sm mt-0.5" style={{ color }}>{desc}</p>
                </div>
                <div className="text-quest-dim text-xl">›</div>
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowEggSelection(false)}
            className="mt-8 text-quest-dim text-sm"
          >
            キャンセル（後でする）
          </button>
          <style>{`
            @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
          `}</style>
        </div>
      )}

      {/* Monster hero */}
      <div className="flex flex-col items-center py-8 mb-6 rounded-2xl bg-gradient-to-b from-purple-950/30 to-transparent">
        <div className="w-56 h-56 animate-float mb-4 mx-auto" style={{ filter: "drop-shadow(0 0 20px rgba(139,92,246,0.3))" }}>
          <Image src={monster.image} alt={monster.name} width={224} height={224} className="w-full h-full object-contain" />
        </div>
        <p className="font-serif text-quest-gold text-xl tracking-wider">
          {data.name}
        </p>
        <p className="text-quest-dim text-xs mt-1">
          {monster.name}
        </p>
      </div>

      {/* Evolution / Rebirth progress card */}
      {(() => {
        const stageLabel =
          data.evolutionStage === 0 ? "たまご" :
          data.evolutionStage >= 3 ? "最終形態" :
          `stage ${data.evolutionStage} / 3`;
        const nextLabel =
          data.evolutionStage === 0 ? "孵化" :
          xpInfo.xpToEvolve !== null ? "進化" : "転生";

        if (data.rebirthPending) {
          // 転生ボタン表示
          return (
            <div className="bg-quest-card border border-purple-500/50 rounded-xl p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex gap-2">
                  {[1, 2, 3].map((s) => (
                    <div key={s} className="w-3 h-3 rounded-full bg-quest-gold" />
                  ))}
                </div>
                <span className="text-xs text-purple-400/70">{stageLabel}</span>
              </div>
              <div className="h-4 bg-quest-border rounded-full overflow-hidden mb-3">
                <div
                  className="h-full w-full bg-gradient-to-r from-purple-700 to-purple-400 animate-shimmer"
                />
              </div>
              <p className="text-purple-400 font-bold text-sm mb-3">
                ✨ 転生の準備ができた！
              </p>
              <button
                onClick={() => setShowEggSelection(true)}
                className="w-full py-3 rounded-xl font-bold text-white text-base"
                style={{
                  background: "linear-gradient(135deg, #7c3aed, #a855f7)",
                  animation: "rebirthPulse 1.5s ease-in-out infinite",
                }}
              >
                ✨ 転生する！
              </button>
              <style>{`
                @keyframes rebirthPulse {
                  0%, 100% { box-shadow: 0 0 0 0 rgba(139,92,246,0.4); }
                  50% { box-shadow: 0 0 0 8px rgba(139,92,246,0); }
                }
              `}</style>
            </div>
          );
        }

        if (xpInfo.xpToEvolve !== null) {
          const approvedPct = Math.min(100, (total / xpInfo.xpToEvolve) * 100);
          const pendingPct = Math.min(100 - approvedPct, (pendingTotal / xpInfo.xpToEvolve) * 100);
          return (
            <div className="bg-quest-card border border-quest-border rounded-xl p-4 mb-4">
              {/* Stage dots + label */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex gap-2">
                  {[1, 2, 3].map((s) => (
                    <div
                      key={s}
                      className={`w-3 h-3 rounded-full ${data.evolutionStage >= s ? "bg-quest-gold" : "bg-quest-border"}`}
                    />
                  ))}
                </div>
                <span className="text-xs text-quest-dim">{stageLabel}</span>
              </div>
              {/* Progress bar */}
              <div className="h-4 bg-quest-border rounded-full overflow-hidden flex mb-2">
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
              {/* Pt info */}
              <div className="flex justify-between items-baseline">
                <p className="text-quest-gold font-bold text-sm">
                  あと {Math.max(0, xpInfo.ptNeeded!)} pt で{nextLabel}！
                </p>
                <span className="text-[11px] text-quest-dim">
                  {total} / {xpInfo.xpToEvolve} pt
                  {pendingTotal > 0 && <span className="ml-1">+ {pendingTotal}(仮)</span>}
                </span>
              </div>
              {/* Evolution path weights */}
              {xpInfo.evolutionWeights && (
                <div className="mt-3 flex gap-2 pt-3 border-t border-quest-border/50">
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
              )}
            </div>
          );
        } else {
          const rebirthPct = Math.min(100, (total / REBIRTH_THRESHOLD) * 100);
          const rebirthPending = Math.min(100 - rebirthPct, (pendingTotal / REBIRTH_THRESHOLD) * 100);
          return (
            <div className="bg-quest-card border border-quest-border rounded-xl p-4 mb-4">
              {/* Stage dots + label */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex gap-2">
                  {[1, 2, 3].map((s) => (
                    <div key={s} className="w-3 h-3 rounded-full bg-quest-gold" />
                  ))}
                </div>
                <span className="text-xs text-quest-dim">{stageLabel}</span>
              </div>
              {/* Progress bar */}
              <div className="h-4 bg-quest-border rounded-full overflow-hidden flex mb-2">
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
              {/* Pt info */}
              <div className="flex justify-between items-baseline">
                <p className="text-purple-400 font-bold text-sm">
                  あと {Math.max(0, REBIRTH_THRESHOLD - total)} pt で転生！
                </p>
                <span className="text-[11px] text-quest-dim">
                  {total} / {REBIRTH_THRESHOLD} pt
                  {pendingTotal > 0 && <span className="ml-1">+ {pendingTotal}(仮)</span>}
                </span>
              </div>
            </div>
          );
        }
      })()}

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

    </div>
  );
}
