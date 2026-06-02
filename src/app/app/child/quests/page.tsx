"use client";

import { useEffect, useRef, useState } from "react";
import { getDeadlineDisplay } from "@/lib/date";
import LoadingSpinner from "@/components/LoadingSpinner";
import QuestActionSheet, { type SheetQuest } from "@/components/QuestActionSheet";
import MonsterMiniCard from "@/components/MonsterMiniCard";
import TreasureStock from "@/components/child/TreasureStock";
import TreasureGetCutscene from "@/components/child/TreasureGetCutscene";
import QuestAddForm from "@/components/child/QuestAddForm";
import QuestListItem from "@/components/child/QuestListItem";
import StampCelebrationOverlay from "@/components/child/StampCelebrationOverlay";
import { getMonsterMiniData, type MonsterMiniData } from "@/lib/monster-mini";
import { computeCompletedCount, sortQuestsForDeclaration } from "@/lib/questProgress";
import { getTreasureCountdown, ALL_DONE_MESSAGES } from "@/lib/treasureCountdown";
import { sumQuestXp } from "@/lib/xp";
import { shouldShowReportHint } from "@/lib/quest-hint";
import { useChildQuests, type Quest } from "@/hooks/useChildQuests";

export default function QuestsPage() {
  const {
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
  } = useChildQuests();
  const [monsterMini, setMonsterMini] = useState<MonsterMiniData | null>(null);
  const [childName, setChildName] = useState<string>("");
  const [activeQuest, setActiveQuest] = useState<Quest | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [reportDeadlineTime, setReportDeadlineTime] = useState<string | null>(null);
  const [minTasksForStreak, setMinTasksForStreak] = useState<number>(1);
  const [allDoneMessageIndex] = useState<number>(() =>
    Math.floor(Math.random() * ALL_DONE_MESSAGES.length),
  );
  const [now, setNow] = useState(() => new Date());
  const pendingTreasureGetRef = useRef<number>(0);
  const [showTreasureGet, setShowTreasureGet] = useState<number>(0);

  useEffect(() => {
    fetch("/api/users/me")
      .then((r) => r.json())
      .then((d) => {
        setReportDeadlineTime(d.reportDeadlineTime ?? null);
        if (typeof d.minTasksForStreak === "number") {
          setMinTasksForStreak(d.minTasksForStreak);
        }
      })
      .catch(() => {});
  }, []);

  // 1分ごとに残り時間を更新
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    fetchMonster();
  }, []);

  async function fetchMonster() {
    const res = await fetch("/api/monster-status");
    if (!res.ok) return;
    const d = await res.json();
    setChildName(d.name ?? "");
    setMonsterMini(
      getMonsterMiniData({
        evolutionStage: d.evolutionStage,
        evolutionPath: d.evolutionPath ?? "",
        side: d.side ?? null,
        studyPt: d.studyPt,
        staminaPt: d.staminaPt,
        lifePt: d.lifePt,
        collectedPaths: d.collectedPaths ?? "[]",
        rebirthEggBonus: d.rebirthEggBonus ?? null,
      }),
    );
  }

  async function handleReport(questId: string, comment: string | null, photoUrl: string | null) {
    const res = await fetch(`/api/quests/${questId}/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comment, photoUrl }),
    });
    if (res.ok) {
      try {
        const data = (await res.json()) as { treasureIds?: string[] };
        const count = data.treasureIds?.length ?? 0;
        if (count > 0) pendingTreasureGetRef.current = count;
      } catch {
        // 旧APIで JSON が無い場合などは無視
      }
    }
    await refreshQuests();
  }

  async function handleSkip(questId: string, reason: string) {
    const res = await fetch(`/api/quests/${questId}/skip`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comment: reason }),
    });
    if (res.ok) {
      // skip でも全タスク達成で STREAK / ALL_COMPLETE 宝箱が生成される。
      // 報告フロー (handleReport) と対称に treasureIds を読み取り、
      // シートが閉じた後に「宝箱ゲット！」演出を出す。
      try {
        const data = (await res.json()) as { treasureIds?: string[] };
        const count = data.treasureIds?.length ?? 0;
        if (count > 0) pendingTreasureGetRef.current = count;
      } catch {
        // 旧 API で JSON が無い場合などは無視
      }
    }
    await refreshQuests();
  }

  const completedCount = computeCompletedCount(quests);
  const sortedQuests = sortQuestsForDeclaration(quests);

  async function handleDeclare(questId: string) {
    // 楽観的更新: 即座に declaredToday=true にする
    setQuests((prev) => prev.map((q) => (q.id === questId ? { ...q, declaredToday: true } : q)));
    questsRef.current = questsRef.current.map((q) =>
      q.id === questId ? { ...q, declaredToday: true } : q,
    );
    try {
      const res = await fetch(`/api/quests/${questId}/declare`, { method: "POST" });
      if (!res.ok) {
        // 失敗したら戻す
        setQuests((prev) => prev.map((q) => (q.id === questId ? { ...q, declaredToday: false } : q)));
        questsRef.current = questsRef.current.map((q) =>
          q.id === questId ? { ...q, declaredToday: false } : q,
        );
      }
    } catch {
      setQuests((prev) => prev.map((q) => (q.id === questId ? { ...q, declaredToday: false } : q)));
    }
  }

  const provisionalPt = sumQuestXp(quests, "REPORTED");
  const confirmedPt = sumQuestXp(quests, "APPROVED");

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <>
      <div className="px-4 pt-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="font-serif text-quest-gold text-lg tracking-wider">
                ⚔ 今日のクエスト
              </h1>
              <p className="text-quest-dim text-xs mt-1">
                {completedCount} / {quests.length} 完了
              </p>
              {(provisionalPt > 0 || confirmedPt > 0) && (
                <div className="flex gap-3 mt-1">
                  {provisionalPt > 0 && (
                    <span className="text-[10px] text-quest-dim">
                      仮 <span className="text-quest-gold/60 font-bold">{provisionalPt}</span> pt
                    </span>
                  )}
                  {confirmedPt > 0 && (
                    <span className="text-[10px] text-quest-dim">
                      本 <span className="text-quest-gold font-bold">{confirmedPt}</span> pt
                    </span>
                  )}
                </div>
              )}
            </div>
            <button
              onClick={() => setShowAddForm((v) => !v)}
              className="text-xs border border-quest-border rounded-lg px-3 py-1.5 text-quest-dim hover:border-quest-gold/40 hover:text-quest-gold transition-colors"
            >
              + タスクを追加
            </button>
          </div>
          {/* Deadline banner */}
          {reportDeadlineTime && (() => {
            const { minutesLeft, urgency } = getDeadlineDisplay(reportDeadlineTime, now);
            if (urgency === "expired") return null;
            const remainingText =
              minutesLeft >= 60
                ? `あと${Math.floor(minutesLeft / 60)}時間${minutesLeft % 60 > 0 ? `${minutesLeft % 60}分` : ""}`
                : `あと${minutesLeft}分`;
            const styles = {
              normal: "bg-green-900/20 border-green-500/30 text-green-400",
              warning: "bg-yellow-900/20 border-yellow-500/30 text-yellow-400",
              danger: "bg-red-900/30 border-red-500/40 text-red-400",
              expired: "",
            }[urgency];
            const icon = urgency === "danger" ? "🚨" : urgency === "warning" ? "⚡" : "⏰";
            const hasPending = quests.some((q) => q.status === "PENDING" || q.status === "REJECTED");
            if (!hasPending) return null;
            return (
              <div className={`mt-3 flex items-center gap-2 rounded-xl border px-3 py-2 text-xs ${styles}`}>
                <span>{icon}</span>
                <span className="flex-1">
                  <span className="font-bold">{reportDeadlineTime}まで</span>に報告すると
                  <span className="font-bold"> +1XP</span>ボーナス！
                </span>
                <span className="font-bold shrink-0">{remainingText}</span>
              </div>
            );
          })()}
          {/* Progress bar */}
          <div className="mt-2 h-1.5 bg-quest-border rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-quest-gold-dark to-quest-gold rounded-full transition-all"
              style={{
                width: quests.length > 0 ? `${(completedCount / quests.length) * 100}%` : "0%",
              }}
            />
          </div>
          {/* Treasure countdown banner */}
          {(() => {
            const countdown = getTreasureCountdown({
              completedCount,
              totalCount: quests.length,
              minTasks: minTasksForStreak,
              allDoneMessageIndex,
            });
            if (countdown.kind === "none") return null;
            const styles =
              countdown.kind === "all_done"
                ? "bg-amber-900/20 border-amber-500/40 text-amber-300"
                : countdown.kind === "to_streak"
                  ? "bg-purple-900/20 border-purple-500/30 text-purple-300"
                  : "bg-yellow-900/20 border-yellow-500/30 text-yellow-300";
            const icon =
              countdown.kind === "all_done" ? "🎉" : countdown.kind === "to_streak" ? "🎁" : "✨";
            return (
              <div
                className={`mt-3 flex items-center gap-2 rounded-xl border px-3 py-2 text-xs ${styles}`}
                data-testid="treasure-countdown"
              >
                <span>{icon}</span>
                <span className="flex-1 font-bold">{countdown.text}</span>
              </div>
            );
          })()}
        </div>

        {/* Monster mini card */}
        {monsterMini && (
          <MonsterMiniCard data={monsterMini} childName={childName} />
        )}

        {/* Treasure stock & open */}
        <div className="flex justify-end mb-3">
          <TreasureStock />
        </div>

        {/* Add task form */}
        {showAddForm && (
          <QuestAddForm
            onClose={() => setShowAddForm(false)}
            onAdded={fetchQuests}
          />
        )}

        {/* Report hint (first time) */}
        {shouldShowReportHint({
          hasQuests: quests.length > 0,
          anyReported: quests.some((q) => q.status !== "PENDING"),
          hasSeen: reportHintDismissed,
          hasEverReported: reportHintDismissed,
        }) && (
          <div className="mb-3 bg-quest-gold/10 border border-quest-gold/30 rounded-xl px-4 py-3 flex items-start gap-3">
            <span className="text-xl shrink-0">👆</span>
            <div className="flex-1">
              <p className="text-quest-gold text-xs font-bold">タスクをタップして報告しよう！</p>
              <p className="text-quest-dim text-[10px] mt-0.5">完了したらタスクをタップ → コメントや写真を添付して報告 → 親が承認するとXPがもらえるよ</p>
            </div>
            <button
              onClick={() => { localStorage.setItem("quest-report-hint-seen", "1"); setReportHintDismissed(true); }}
              className="text-quest-dim/60 text-sm leading-none shrink-0"
              aria-label="ヒントを閉じる"
            >
              ✕
            </button>
          </div>
        )}

        {/* Quest list */}
        <div className="flex flex-col gap-3">
          {quests.length === 0 && (
            <p className="text-quest-dim text-sm text-center py-12">
              今日のクエストはまだないよ。
              <br />
              上の「タスクを追加」か、管理者（親）に作ってもらおう！
            </p>
          )}
          {sortedQuests.map((quest) => (
            <QuestListItem
              key={quest.id}
              quest={quest}
              onOpen={setActiveQuest}
              onDeclare={handleDeclare}
            />
          ))}
        </div>
      </div>

      {/* Quest action sheet */}
      {activeQuest && (
        <QuestActionSheet
          quest={activeQuest as SheetQuest}
          hasDeadline={activeQuest.hasDeadline}
          questsCompleted={completedCount}
          questsTotal={quests.length}
          onReport={handleReport}
          onSkip={handleSkip}
          onClose={() => {
            setActiveQuest(null);
            if (pendingTreasureGetRef.current > 0) {
              setShowTreasureGet(pendingTreasureGetRef.current);
              pendingTreasureGetRef.current = 0;
            }
          }}
        />
      )}

      {/* 宝箱ゲット演出（タスク完了エフェクトのあとに表示） */}
      {showTreasureGet > 0 && (
        <TreasureGetCutscene
          count={showTreasureGet}
          onClose={() => setShowTreasureGet(0)}
        />
      )}

      {/* スタンプ祝福オーバーレイ（全件を1枚にまとめて表示） */}
      <StampCelebrationOverlay
        stampQueue={stampQueue}
        onClose={() => setStampQueue([])}
      />
    </>
  );
}
