"use client";

import { useEffect, useRef, useState } from "react";
import { getDeadlineDisplay, todayStringJST } from "@/lib/date";
import LoadingSpinner from "@/components/LoadingSpinner";
import QuestActionSheet, { type SheetQuest } from "@/components/QuestActionSheet";
import MonsterMiniCard from "@/components/MonsterMiniCard";
import TreasureStock from "@/components/child/TreasureStock";
import TreasureGetCutscene from "@/components/child/TreasureGetCutscene";
import QuestAddForm from "@/components/child/QuestAddForm";
import QuestListItem from "@/components/child/QuestListItem";
import StampCelebrationOverlay from "@/components/child/StampCelebrationOverlay";
import CheckinPill from "@/components/child/CheckinPill";
import CheckinSuccessCutscene from "@/components/child/CheckinSuccessCutscene";
import QuestStatusCard from "@/components/child/QuestStatusCard";
import type { CheckinTodayStatus } from "@/lib/checkinPill";
import { getMonsterMiniData, type MonsterMiniData } from "@/lib/monster-mini";
import { computeCompletedCount, computeSkippedCount, sortQuestsForDeclaration } from "@/lib/questProgress";
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
  const [checkin, setCheckin] = useState<{
    enabled: boolean;
    deadline: string | null;
    todayStatus: CheckinTodayStatus;
    currentStreak: number;
  } | null>(null);
  const [checkinJustNow, setCheckinJustNow] = useState<boolean>(false);
  const [checkinCutsceneStreak, setCheckinCutsceneStreak] = useState<number | null>(null);
  const [minTasksForStreak, setMinTasksForStreak] = useState<number>(1);
  const [treasureStatus, setTreasureStatus] = useState<{ locked: number; unlocked: number } | null>(
    null,
  );
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

  // チェックイン記録: マウント時に1回だけ POST し、当日の状態（todayStatus/deadline/currentStreak/justNow）を取得。
  // GET /api/checkin/calendar とは別ソースであり、こちらはピルの数字表示専用のため競合しない。
  useEffect(() => {
    fetch("/api/checkin/today", { method: "POST" })
      .then((r) => r.json())
      .then(
        (d: {
          enabled?: boolean;
          deadline?: string | null;
          todayStatus?: CheckinTodayStatus;
          justNow?: boolean;
          currentStreak?: number;
        }) => {
          setCheckin({
            enabled: !!d.enabled,
            deadline: d.deadline ?? null,
            todayStatus: d.todayStatus ?? "pending",
            currentStreak: d.currentStreak ?? 0,
          });
          if (d.enabled && d.justNow) {
            setCheckinJustNow(true);
            setCheckinCutsceneStreak(d.currentStreak ?? 0);
          }
        },
      )
      .catch(() => {});
  }, []);

  // 宝箱ストック件数: QuestStatusCard の表示可否判定に使う（あける操作自体は TreasureStock 側で完結）
  useEffect(() => {
    function fetchTreasureStatus() {
      fetch("/api/treasures/status", { cache: "no-store" })
        .then((r) => r.json())
        .then((d: { locked?: number; unlocked?: number }) => {
          setTreasureStatus({ locked: d.locked ?? 0, unlocked: d.unlocked ?? 0 });
        })
        .catch(() => {});
    }
    fetchTreasureStatus();
    window.addEventListener("treasure-changed", fetchTreasureStatus);
    return () => window.removeEventListener("treasure-changed", fetchTreasureStatus);
  }, []);

  // 1分ごとに残り時間を更新
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
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
        monsterSetId: d.monsterSetId ?? null,
      }),
    );
  }

  useEffect(() => {
    // マウント時に一度だけモンスター情報を取得する。fetchMonster内部でsetChildName/setMonsterMiniを呼ぶが、
    // 外部API（サーバー）との同期が目的でありレンダー時算出はできないためuseEffect内が正しい。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchMonster();
  }, []);

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
  const skippedCount = computeSkippedCount(quests);
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

  const treasureCountdown = getTreasureCountdown({
    completedCount,
    totalCount: quests.length,
    minTasks: minTasksForStreak,
    skippedCount,
    allDoneMessageIndex,
  });
  const hasTreasureStock =
    (treasureStatus?.locked ?? 0) > 0 || (treasureStatus?.unlocked ?? 0) > 0;
  const showQuestStatusCard = quests.length > 0 || hasTreasureStock;

  return (
    <>
      <div className="px-4 pt-6">
        {/* Checkin pill（常設・折りたたみ） */}
        {checkin && (
          <CheckinPill
            enabled={checkin.enabled}
            todayStatus={checkin.todayStatus}
            currentStreak={checkin.currentStreak}
            deadline={checkin.deadline ?? ""}
            todayStr={todayStringJST()}
            justNow={checkinJustNow}
          />
        )}

        {/* Header */}
        <div className="mb-4">
          <div className="flex justify-between items-center">
            <h1 className="font-serif text-quest-gold text-lg tracking-wider">
              ⚔ 今日のクエスト
            </h1>
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
        </div>

        {/* Quest status card（完了数・進捗バー・pt・宝箱カウントダウン・宝箱ストック） */}
        {showQuestStatusCard && (
          <QuestStatusCard
            completedCount={completedCount}
            totalCount={quests.length}
            provisionalPt={provisionalPt}
            confirmedPt={confirmedPt}
            countdown={treasureCountdown}
          >
            <TreasureStock variant="card" />
          </QuestStatusCard>
        )}

        {/* Monster mini card */}
        {monsterMini && (
          <MonsterMiniCard data={monsterMini} childName={childName} />
        )}

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

      {/* チェックイン成功演出 */}
      {checkinCutsceneStreak !== null && (
        <CheckinSuccessCutscene
          currentStreak={checkinCutsceneStreak}
          onClose={() => setCheckinCutsceneStreak(null)}
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
