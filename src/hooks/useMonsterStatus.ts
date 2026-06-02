"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { STREAK_MILESTONES, getUnreadAchievements } from "@/lib/streakMilestones";

export type MonsterData = {
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

export type StreakData = {
  currentStreak: number;
  bestStreak: number;
  monthlyDays: number;
  lastAchievedDate: string | null;
  currentTitle: { title: string; emoji: string } | null;
};

type UseMonsterStatusResult = {
  data: MonsterData | null;
  streak: StreakData | null;
  loading: boolean;
  showEvolution: boolean;
  setShowEvolution: (v: boolean) => void;
  hatched: boolean;
  setHatched: (v: boolean) => void;
  reborn: boolean;
  setReborn: (v: boolean) => void;
  unlockedAchievement: typeof STREAK_MILESTONES[number] | null;
  setUnlockedAchievement: (v: typeof STREAK_MILESTONES[number] | null) => void;
  setData: (d: MonsterData | null) => void;
  fetchStatus: () => Promise<any>;
  prevStageRef: React.MutableRefObject<number | null>;
  selfRebirthRef: React.MutableRefObject<boolean>;
};

export function useMonsterStatus(): UseMonsterStatusResult {
  const [data, setData] = useState<MonsterData | null>(null);
  const [streak, setStreak] = useState<StreakData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEvolution, setShowEvolution] = useState(false);
  const [hatched, setHatched] = useState(false);
  const [reborn, setReborn] = useState(false);
  const [unlockedAchievement, setUnlockedAchievement] = useState<typeof STREAK_MILESTONES[number] | null>(null);
  const prevStageRef = useRef<number | null>(null);
  const selfRebirthRef = useRef(false);

  const fetchStatus = () =>
    fetch("/api/monster-status").then((r) => (r.ok ? r.json() : null));

  const checkAchievementUnlock = (currentStreak: number) => {
    try {
      const seenTitles: string[] = JSON.parse(localStorage.getItem("seenAchievementTitles") ?? "[]");
      const unread = getUnreadAchievements(currentStreak, seenTitles);
      if (unread.length > 0) {
        setUnlockedAchievement(unread[unread.length - 1]);
      }
    } catch {
      // localStorageが使えない環境では無視
    }
  };

  useEffect(() => {
    fetchStatus()
      .then((d) => {
        if (!d) return;
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
        checkAchievementUnlock(d.currentStreak);
      })
      .finally(() => setLoading(false));

    const supabase = createClient();
    const channel = supabase
      .channel("monster-changes")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "User" }, () => {
        fetchStatus().then((d) => {
          if (!d) return;
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
          checkAchievementUnlock(d.currentStreak);
        });
      })
      .subscribe();

    const onVisible = () => { if (document.visibilityState === "visible") fetchStatus(); };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", onVisible);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    data,
    streak,
    loading,
    showEvolution,
    setShowEvolution,
    hatched,
    setHatched,
    reborn,
    setReborn,
    unlockedAchievement,
    setUnlockedAchievement,
    setData,
    fetchStatus,
    prevStageRef,
    selfRebirthRef,
  };
}
