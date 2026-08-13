"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { STREAK_MILESTONES, getUnreadAchievements } from "@/lib/streakMilestones";
import type { MonsterStatusResponse } from "@/types";

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
  reborn: boolean;
  setReborn: (v: boolean) => void;
  unlockedAchievement: typeof STREAK_MILESTONES[number] | null;
  setUnlockedAchievement: (v: typeof STREAK_MILESTONES[number] | null) => void;
  setData: (d: MonsterData | null) => void;
  fetchStatus: () => Promise<MonsterStatusResponse | null>;
};

export function useMonsterStatus(): UseMonsterStatusResult {
  const [data, setData] = useState<MonsterData | null>(null);
  const [streak, setStreak] = useState<StreakData | null>(null);
  const [loading, setLoading] = useState(true);
  const [reborn, setReborn] = useState(false);
  const [unlockedAchievement, setUnlockedAchievement] = useState<typeof STREAK_MILESTONES[number] | null>(null);

  const fetchStatus = (): Promise<MonsterStatusResponse | null> =>
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

  function applyStatus(d: MonsterStatusResponse) {
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
  }

  useEffect(() => {
    fetchStatus()
      .then((d) => { if (d) applyStatus(d); })
      .finally(() => setLoading(false));

    const supabase = createClient();
    const channel = supabase
      .channel("monster-changes")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "User" }, () => {
        fetchStatus().then((d) => { if (d) applyStatus(d); });
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
    reborn,
    setReborn,
    unlockedAchievement,
    setUnlockedAchievement,
    setData,
    fetchStatus,
  };
}
