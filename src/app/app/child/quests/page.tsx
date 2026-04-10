"use client";

import { useEffect, useRef, useState } from "react";
import { CATEGORY_LABEL, CATEGORY_COLOR, DAY_LABELS } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import { getDeadlineDisplay } from "@/lib/date";
import type { Category, QuestStatus } from "@/types";
import LoadingSpinner from "@/components/LoadingSpinner";
import QuestActionSheet, { type SheetQuest } from "@/components/QuestActionSheet";
import MonsterMiniCard from "@/components/MonsterMiniCard";
import { getMonsterMiniData, type MonsterMiniData } from "@/lib/monster-mini";
import { computeCompletedCount } from "@/lib/questProgress";
import { findNewlyStampedApproval } from "@/lib/stampCelebration";

type Quest = {
  id: string;
  date: string;
  status: QuestStatus;
  comment: string | null;
  rejectionReason: string | null;
  approvalStamp: string | null;
  deadlineBonusEarned: boolean;
  photoUrl: string | null;
  hasDeadline: boolean;
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

type FormMode = "regular" | "temporary";

export default function QuestsPage() {
  const [quests, setQuests] = useState<Quest[]>([]);
  const [loading, setLoading] = useState(true);
  const [monsterMini, setMonsterMini] = useState<MonsterMiniData | null>(null);
  const [childName, setChildName] = useState<string>("");
  const [activeQuest, setActiveQuest] = useState<Quest | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>("temporary");
  const [form, setForm] = useState({
    title: "",
    category: "STUDY" as Category,
    repeatDays: [0, 1, 2, 3, 4, 5, 6] as number[],
  });
  const [submitting, setSubmitting] = useState(false);
  const [reportDeadlineTime, setReportDeadlineTime] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [stampCelebration, setStampCelebration] = useState<{ stamp: string; questTitle: string } | null>(null);
  const questsRef = useRef<Quest[]>([]);

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

  useEffect(() => {
    fetch("/api/users/me")
      .then((r) => r.json())
      .then((d) => setReportDeadlineTime(d.reportDeadlineTime ?? null))
      .catch(() => {});
  }, []);

  // 1分ごとに残り時間を更新
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    fetchQuests();
    fetchMonster();

    const supabase = createClient();
    const channel = supabase
      .channel("quest-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "QuestInstance" }, async () => {
        await refreshQuests();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
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
      }),
    );
  }

  async function refreshQuests() {
    const res = await fetch("/api/quests/today");
    if (!res.ok) return;
    const newQuests: Quest[] = await res.json();
    const celebration = findNewlyStampedApproval(questsRef.current, newQuests);
    if (celebration) setStampCelebration(celebration);
    questsRef.current = newQuests;
    setQuests(newQuests);
  }

  async function fetchQuests() {
    setLoading(true);
    const res = await fetch("/api/quests/today");
    if (res.ok) {
      const loaded: Quest[] = await res.json();

      // 別画面にいた間にスタンプ承認された場合の祝福チェック
      const stored = sessionStrage.getItem("prevQuestStates");
      if (stored) {
        try {
          const prev = JSON.parse(stored);
          const celebration = findNewlyStampedApproval(prev, loaded);
          if (celebration) setStampCelebration(celebration);
        } catch { /* ignore */ }
        sessionStorage.removeItem("prevQuestStates");
      }

      questsRef.current = loaded;
      setQuests(loaded);
    }
    setLoading(false);
  }

  async function handleReport(questId: string, comment: string | null, photoUrl: string | null) {
    await fetch(`/api/quests/${questId}/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comment, photoUrl }),
    });
    await refreshQuests();
  }

  async function handleSkip(questId: string, reason: string) {
    await fetch(`/api/quests/${questId}/skip`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comment: reason }),
    });
    await refreshQuests();
  }

  async function handleAddTask() {
    setSubmitting(true);
    const isTemporary = formMode === "temporary";
    const emoji = CATEGORY_LABEL[form.category].emoji;
    const body = isTemporary
      ? {
          title: form.title,
          emoji,
          category: form.category,
          isTemporary: true,
        }
      : {
          title: form.title,
          emoji,
          category: form.category,
          isTemporary: false,
          repeatDays: form.repeatDays,
        };

    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSubmitting(false);
    if (res.ok) {
      setShowAddForm(false);
      setForm({ title: "", category: "STUDY", repeatDays: [0, 1, 2, 3, 4, 5, 6] });
      fetchQuests();
    }
  }

  function toggleDay(day: number) {
    setForm((f) => ({
      ...f,
      repeatDays: f.repeatDays.includes(day)
        ? f.repeatDays.filter((d) => d !== day)
        : [...f.repeatDays, day].sort(),
    }));
  }

  const completedCount = computeCompletedCount(quests);

  const provisionalPt = quests
    .filter((q) => q.status === "REPORTED")
    .reduce((sum, q) => {
      let xp = 1;
      if (q.deadlineBonusEarned) xp++;
      if (q.template.photoBonus && q.photoUrl) xp++;
      return sum + xp;
    }, 0);

  const confirmedPt = quests
    .filter((q) => q.status === "APPROVED")
    .reduce((sum, q) => {
      let xp = 1;
      if (q.deadlineBonusEarned) xp++;
      if (q.template.photoBonus && q.photoUrl) xp++;
      return sum + xp;
    }, 0);

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
        </div>

        {/* Monster mini card */}
        {monsterMini && (
          <MonsterMiniCard data={monsterMini} childName={childName} />
        )}

        {/* Add task form */}
        {showAddForm && (
          <div className="bg-quest-card border border-quest-border rounded-xl p-4 mb-6">
            {/* Mode tabs */}
            <div className="flex gap-1 mb-4 bg-quest-bg rounded-lg p-1">
              <button
                onClick={() => setFormMode("temporary")}
                className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  formMode === "temporary"
                    ? "bg-quest-gold/20 text-quest-gold border border-quest-gold/30"
                    : "text-quest-dim"
                }`}
              >
                ⚡ 一時タスク
              </button>
              <button
                onClick={() => setFormMode("regular")}
                className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  formMode === "regular"
                    ? "bg-quest-gold/20 text-quest-gold border border-quest-gold/30"
                    : "text-quest-dim"
                }`}
              >
                📅 通常タスク
              </button>
            </div>

            <p className="text-quest-dim text-[10px] mb-3">
              {formMode === "temporary"
                ? "今日だけ表示されるタスクを追加します"
                : "毎週繰り返す自分のタスクを追加します"}
            </p>

            {/* Title */}
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              maxLength={32}
              placeholder="タスク名を入力..."
              className="w-full bg-quest-bg border border-quest-border rounded-lg px-3 py-2 text-sm text-quest-text placeholder:text-quest-dim/50 focus:outline-none focus:border-quest-gold/30 mb-3"
            />

            {/* Category */}
            <div className="flex gap-1.5 mb-3">
              {(["STUDY", "STAMINA", "LIFE"] as Category[]).map((cat) => {
                const label = CATEGORY_LABEL[cat];
                return (
                  <button
                    key={cat}
                    onClick={() => setForm((f) => ({ ...f, category: cat }))}
                    className={`flex-1 py-1.5 rounded-lg text-xs border transition-colors ${
                      form.category === cat
                        ? "border-quest-gold bg-quest-gold/10 text-quest-gold"
                        : "border-quest-border text-quest-dim"
                    }`}
                  >
                    {label.emoji} {label.name}
                  </button>
                );
              })}
            </div>

            {/* Repeat days (regular only) */}
            {formMode === "regular" && (
              <div className="flex gap-1 mb-3">
                {DAY_LABELS.map((label, i) => (
                  <button
                    key={i}
                    onClick={() => toggleDay(i)}
                    className={`w-8 h-8 rounded-lg text-xs font-bold border transition-colors ${
                      form.repeatDays.includes(i)
                        ? "border-quest-gold bg-quest-gold/10 text-quest-gold"
                        : "border-quest-border text-quest-dim"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleAddTask}
                disabled={!form.title.trim() || submitting}
                className="btn-gold flex-1 text-xs py-2 disabled:opacity-40"
              >
                {submitting ? "追加中..." : "追加する"}
              </button>
              <button
                onClick={() => setShowAddForm(false)}
                className="text-quest-dim text-xs border border-quest-border rounded-xl px-3 py-2"
              >
                キャンセル
              </button>
            </div>
          </div>
        )}

        {/* Quest list */}
        <div className="flex flex-col gap-3">
          {quests.length === 0 && (
            <p className="text-quest-dim text-sm text-center py-12">
              今日のクエストはまだないよ。
              <br />
              上の「タスクを追加」か、ギルドマスター（親）に作ってもらおう！
            </p>
          )}
          {quests.map((quest) => {
            const cat = CATEGORY_LABEL[quest.template.category];
            let xp = 1;
            if (quest.deadlineBonusEarned) xp++;
            if (quest.template.photoBonus && quest.photoUrl) xp++;
            const isTemporary = quest.template.isTemporary;
            const taskStreak = quest.template.taskStreaks[0]?.currentStreak ?? 0;
            const isApproved = quest.status === "APPROVED";
            const isReported = quest.status === "REPORTED";
            const isSkipped = quest.status === "SKIPPED";
            const isSkipReported = quest.status === "SKIP_REPORTED";
            const isRejected = quest.status === "REJECTED";
            const isDone = isApproved || isReported || isSkipped || isSkipReported;

            return (
              <div key={quest.id}>
                <div
                  onClick={() => (!isDone || isRejected) && setActiveQuest(quest)}
                  className={`relative bg-quest-card border rounded-xl overflow-hidden transition-all ${
                    isRejected
                      ? "border-red-400/40 cursor-pointer hover:border-red-400/60 active:scale-[0.99]"
                      : isDone
                      ? "border-quest-border opacity-60"
                      : "border-quest-border cursor-pointer hover:border-quest-gold/30 active:scale-[0.99]"
                  }`}
                >
                  <div className="flex items-center gap-3 p-4">
                    {/* Icon */}
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-xl shrink-0"
                      style={{ backgroundColor: `${CATEGORY_COLOR[quest.template.category]}15` }}
                    >
                      {quest.template.emoji}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-1.5">
                        <p className="text-sm font-medium break-all">{quest.template.title}</p>
                        {isTemporary && (
                          <span className="text-[9px] text-amber-400/70 border border-amber-400/30 rounded px-1">
                            一時
                          </span>
                        )}
                        {quest.template.createdBy === "CHILD" && (
                          <span className="text-[9px] text-purple-400/70 border border-purple-400/30 rounded px-1">
                            仮
                          </span>
                        )}
                        {taskStreak >= 1 && (
                          <span className="text-[9px] text-orange-400 border border-orange-400/30 rounded px-1 shrink-0">
                            🔥{taskStreak}日
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-quest-dim">
                          {cat.emoji} {cat.name}
                        </span>
                      </div>
                    </div>

                    {/* XP + Status */}
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={`text-xs font-bold ${
                        isSkipped || isSkipReported
                          ? "text-quest-dim line-through"
                          : isApproved
                          ? "text-quest-gold"
                          : isReported
                          ? "text-quest-gold/50"
                          : "text-quest-gold"
                      }`}>
                        +{xp}XP
                      </span>

                      {isApproved ? (
                        <div className="flex flex-col items-end gap-0.5">
                          {quest.approvalStamp ? (
                            <div className="w-9 h-9 rounded-full bg-quest-gold/10 border border-quest-gold/30 flex items-center justify-center text-xl animate-pulse-once">
                              {quest.approvalStamp}
                            </div>
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 text-sm">✓</div>
                          )}
                          <span className="text-[9px] text-green-400/70">承認済み</span>
                        </div>
                      ) : isReported ? (
                        <div className="flex flex-col items-end gap-0.5">
                          <div className="w-7 h-7 rounded-full bg-green-500/10 flex items-center justify-center text-green-400/50 text-sm">✓</div>
                          <span className="text-[9px] text-quest-dim">確認中...</span>
                        </div>
                      ) : isRejected ? (
                        <div className="flex flex-col items-end gap-0.5">
                          <div className="w-7 h-7 rounded-full bg-red-400/10 flex items-center justify-center text-red-400 text-sm">✕</div>
                          <span className="text-[9px] text-red-400/70">差し戻し</span>
                        </div>
                      ) : isSkipReported ? (
                        <div className="flex flex-col items-end gap-0.5">
                          <div className="w-7 h-7 rounded-full bg-red-400/10 flex items-center justify-center text-red-400/50 text-sm">−</div>
                          <span className="text-[9px] text-quest-dim">申請中...</span>
                        </div>
                      ) : isSkipped ? (
                        <div className="flex flex-col items-end gap-0.5">
                          <div className="w-7 h-7 rounded-full bg-quest-border/30 flex items-center justify-center text-quest-dim text-sm">−</div>
                          <span className="text-[9px] text-quest-dim">スキップ</span>
                        </div>
                      ) : (
                        <div className="w-7 h-7 rounded-full border-2 border-quest-border/60" />
                      )}
                    </div>
                  </div>
                </div>

                {/* 差し戻し理由バナー */}
                {isRejected && quest.rejectionReason && (
                  <div className="bg-red-400/5 border border-red-400/20 border-t-0 rounded-b-xl px-4 py-3 flex items-start gap-2">
                    <span className="text-red-400 text-xs mt-0.5 shrink-0">⚠</span>
                    <div>
                      <p className="text-xs text-red-400/80 font-medium">差し戻し理由</p>
                      <p className="text-xs text-red-300/70 mt-0.5">{quest.rejectionReason}</p>
                      <p className="text-[10px] text-quest-dim mt-1">タップしてもう一度報告してね</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
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
          onClose={() => setActiveQuest(null)}
        />
      )}

      {/* スタンプ祝福オーバーレイ */}
      {stampCelebration && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70"
          onClick={() => setStampCelebration(null)}
        >
          <div className="flex flex-col items-center gap-4 select-none">
            <div className="text-[96px] animate-stamp-pop">
              {stampCelebration.stamp}
            </div>
            <div className="text-center">
              <p className="text-white font-bold text-xl">承認されたよ！</p>
              <p className="text-white/70 text-sm mt-1">「{stampCelebration.questTitle}」</p>
            </div>
            <p className="text-white/40 text-xs mt-2">タップで閉じる</p>
          </div>
        </div>
      )}
    </>
  );
}
