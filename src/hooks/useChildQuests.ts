"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Category, QuestStatus } from "@/types";
import { findNewlyStampedApprovals, type StampCelebration } from "@/lib/stampCelebration";

export type Quest = {
  id: string;
  date: string;
  status: QuestStatus;
  comment: string | null;
  rejectionReason: string | null;
  approvalStamp: string | null;
  deadlineBonusEarned: boolean;
  photoUrl: string | null;
  hasDeadline: boolean;
  idleDays: number;
  eligibleForDeclaration: boolean;
  declaredToday: boolean;
  template: {
    id: string;
    title: string;
    emoji: string;
    category: Category;
    isTemporary: boolean;
    createdBy: string;
    photoBonus: boolean;
    taskStreaks: { currentStreak: number; bestStreak: number }[];
  };
};

type UseChildQuestsResult = {
  quests: Quest[];
  loading: boolean;
  setQuests: React.Dispatch<React.SetStateAction<Quest[]>>;
  questsRef: React.MutableRefObject<Quest[]>;
  stampQueue: StampCelebration[];
  setStampQueue: React.Dispatch<React.SetStateAction<StampCelebration[]>>;
  reportHintDismissed: boolean;
  setReportHintDismissed: React.Dispatch<React.SetStateAction<boolean>>;
  fetchQuests: () => Promise<void>;
  refreshQuests: () => Promise<void>;
};

export function useChildQuests(): UseChildQuestsResult {
  const [quests, setQuests] = useState<Quest[]>([]);
  const [loading, setLoading] = useState(true);
  const [stampQueue, setStampQueue] = useState<StampCelebration[]>([]);
  const [reportHintDismissed, setReportHintDismissed] = useState(
    () => typeof window !== "undefined" && !!localStorage.getItem("quest-report-hint-seen"),
  );
  const questsRef = useRef<Quest[]>([]);
  const refreshControllerRef = useRef<AbortController | null>(null);

  // 離脱時にクエスト状態を保存（別画面から戻った時のスタンプ祝福検知用）
  useEffect(() => {
    return () => {
      if (questsRef.current.length > 0) {
        sessionStorage.setItem("prevQuestStates", JSON.stringify(
          questsRef.current.map((q) => ({
            id: q.id,
            status: q.status,
            approvalStamp: q.approvalStamp ?? null,
            template: { title: q.template.title },
          })),
        ));
      }
    };
  }, []);

  async function refreshQuests() {
    // 前の進行中リクエストをキャンセルして最新結果だけを使う（race condition 防止）
    refreshControllerRef.current?.abort();
    const controller = new AbortController();
    refreshControllerRef.current = controller;
    try {
      const res = await fetch("/api/quests/today", { signal: controller.signal });
      if (!res.ok) return;
      const newQuests: Quest[] = await res.json();
      if (controller.signal.aborted) return;
      const newCelebrations = findNewlyStampedApprovals(questsRef.current, newQuests);
      if (newCelebrations.length > 0) {
        setStampQueue((prev) => [...prev, ...newCelebrations]);
      }
      questsRef.current = newQuests;
      setQuests(newQuests);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
    }
  }

  async function fetchQuests() {
    setLoading(true);
    const res = await fetch("/api/quests/today");
    if (res.ok) {
      const loaded: Quest[] = await res.json();

      // 別画面にいた間にスタンプ承認された場合の祝福チェック
      const stored = sessionStorage.getItem("prevQuestStates");
      if (stored) {
        try {
          const prev = JSON.parse(stored);
          const newCelebrations = findNewlyStampedApprovals(prev, loaded);
          if (newCelebrations.length > 0) setStampQueue(newCelebrations);
        } catch { /* ignore */ }
        sessionStorage.removeItem("prevQuestStates");
      }

      if (loaded.some((q) => q.status !== "PENDING")) {
        localStorage.setItem("quest-report-hint-seen", "1");
        setReportHintDismissed(true);
      }
      questsRef.current = loaded;
      setQuests(loaded);
    }
    setLoading(false);
  }

  useEffect(() => {
    // マウント時に一度だけ今日のクエストを取得する。fetchQuests内部でsetLoading/setQuestsを呼ぶが、
    // 外部API（サーバー）との同期が目的でありレンダー時算出はできないためuseEffect内が正しい。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchQuests();

    const supabase = createClient();
    const channel = supabase
      .channel("quest-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "QuestInstance" }, async () => {
        await refreshQuests();
      })
      .subscribe();

    const onVisible = () => { if (document.visibilityState === "visible") refreshQuests(); };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return {
    quests,
    loading,
    setQuests,
    questsRef,
    stampQueue,
    setStampQueue,
    reportHintDismissed,
    setReportHintDismissed,
    fetchQuests,
    refreshQuests,
  };
}
