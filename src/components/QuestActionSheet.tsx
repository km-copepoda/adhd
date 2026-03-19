"use client";

import { useState } from "react";
import { DIFFICULTY_LABEL, CATEGORY_LABEL, CATEGORY_COLOR, XP_MAP } from "@/lib/constants";
import type { Category, Difficulty, QuestStatus } from "@/types";

export type SheetQuest = {
  id: string;
  status: QuestStatus;
  template: {
    title: string;
    emoji: string;
    category: Category;
    difficulty: Difficulty;
    taskStreaks: { currentStreak: number; bestStreak: number }[];
  };
};

type Props = {
  quest: SheetQuest;
  questsCompleted: number;
  questsTotal: number;
  onReport: (questId: string, comment: string | null) => Promise<void>;
  onSkip: (questId: string, reason: string) => Promise<void>;
  onClose: () => void;
};

type SheetState = "idle" | "submitting" | "success-complete" | "success-skip";

export default function QuestActionSheet({ quest, questsCompleted, questsTotal, onReport, onSkip, onClose }: Props) {
  const [comment, setComment] = useState("");
  const [showComment, setShowComment] = useState(false);
  const [showSkip, setShowSkip] = useState(false);
  const [skipReason, setSkipReason] = useState("");
  const [sheetState, setSheetState] = useState<SheetState>("idle");

  const cat = CATEGORY_LABEL[quest.template.category];
  const diff = DIFFICULTY_LABEL[quest.template.difficulty];
  const xp = XP_MAP[quest.template.difficulty];
  const streak = quest.template.taskStreaks[0]?.currentStreak ?? 0;

  async function handleReport() {
    setSheetState("submitting");
    await onReport(quest.id, comment || null);
    setSheetState("success-complete");
    setTimeout(() => onClose(), 1800);
  }

  async function handleSkip() {
    if (!skipReason.trim()) return;
    setSheetState("submitting");
    await onSkip(quest.id, skipReason);
    setSheetState("success-skip");
    setTimeout(() => onClose(), 1800);
  }

  const isSubmitting = sheetState === "submitting";
  const isSuccess = sheetState === "success-complete" || sheetState === "success-skip";

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center px-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" />

      {/* Sheet: flex column, max 85dvh, scroll inside */}
      <div
        className="relative bg-quest-card rounded-2xl shadow-2xl flex flex-col w-full max-w-md max-h-[85dvh]"
        onClick={(e) => e.stopPropagation()}
      >
        {isSuccess ? (
          /* ── Success state ── */
          <div className="text-center py-8 px-5">
            {sheetState === "success-complete" ? (
              <>
                <p className="text-5xl mb-3">🎉</p>
                <p className="text-2xl font-black text-quest-gold mb-1">+{xp}pt ゲット！</p>
                <p className="text-xs text-quest-dim mb-4">親の確認でポイント確定</p>
                {/* Quest progress */}
                {questsTotal > 0 && (() => {
                  const newCompleted = questsCompleted + 1;
                  const remaining = questsTotal - newCompleted;
                  const allDone = remaining <= 0;
                  return (
                    <div className="bg-quest-bg rounded-xl px-4 py-3 text-sm">
                      <p className="text-quest-dim text-xs mb-1">今日のクエスト</p>
                      <p className="font-bold text-quest-text">
                        {newCompleted} / {questsTotal} 完了
                      </p>
                      {allDone ? (
                        <p className="text-quest-gold font-bold mt-1">🏆 全部クリア！すごい！</p>
                      ) : (
                        <p className="text-quest-dim text-xs mt-1">あと{remaining}個！</p>
                      )}
                    </div>
                  );
                })()}
              </>
            ) : (
              <>
                <p className="text-5xl mb-3">😴</p>
                <p className="text-xl font-bold text-quest-gold">スキップを申請したよ</p>
                <p className="text-xs text-quest-dim mt-2">親が確認するよ</p>
              </>
            )}
          </div>
        ) : (
          <>
            {/* ── Scrollable upper area ── */}
            <div className="overflow-y-auto flex-1 px-5 pt-5 pb-2">
              {/* Quest info header */}
              <div className="flex items-center gap-3 mb-5">
                <div
                  className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl shrink-0"
                  style={{ backgroundColor: `${CATEGORY_COLOR[quest.template.category]}15` }}
                >
                  {quest.template.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-bold text-quest-text truncate">{quest.template.title}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span
                      className="text-[11px] px-1.5 py-0.5 rounded"
                      style={{ backgroundColor: `${diff.color}20`, color: diff.color }}
                    >
                      {diff.name}
                    </span>
                    <span className="text-[11px] text-quest-dim">{cat.emoji} {cat.name}</span>
                    {streak >= 1 && (
                      <span className="text-[11px] text-orange-400">🔥{streak}日</span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0 ml-2">
                  <p className="text-2xl font-black text-quest-gold leading-none">+{xp}</p>
                  <p className="text-[10px] text-quest-dim mt-0.5">XP</p>
                </div>
              </div>

              {/* Complete button */}
              <button
                onClick={handleReport}
                disabled={isSubmitting}
                className="btn-gold w-full py-4 text-base font-bold rounded-xl mb-2 disabled:opacity-50"
              >
                {isSubmitting ? "送信中..." : "⚔ クエスト完了！"}
              </button>

              {/* Comment toggle */}
              <button
                onClick={() => setShowComment((v) => !v)}
                className="w-full text-xs text-quest-dim py-2 flex items-center justify-center gap-1"
              >
                💬 コメントを追加
                <span className="text-[10px] opacity-60">{showComment ? "▲" : "▼"}</span>
              </button>

              {showComment && (
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="今日の感想など（なくてもOK）"
                  className="w-full bg-quest-bg border border-quest-border rounded-xl px-3 py-2 text-sm text-quest-text placeholder:text-quest-dim/50 focus:outline-none focus:border-quest-gold/30 resize-none h-16 mt-1"
                />
              )}
            </div>

            {/* ── Always-visible skip footer ── */}
            <div
              className="shrink-0 px-5 pt-2"
              style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom, 0px) + 0.75rem)" }}
            >
              <div className="border-t border-quest-border/40 mb-2" />

              <button
                onClick={() => setShowSkip((v) => !v)}
                className="w-full text-xs text-quest-dim py-2 flex items-center justify-center gap-1"
              >
                😴 今日はできない場合
                <span className="text-[10px] opacity-60">{showSkip ? "▲" : "▼"}</span>
              </button>

              {showSkip && (
                <div className="mt-2 space-y-2">
                  <input
                    type="text"
                    value={skipReason}
                    onChange={(e) => setSkipReason(e.target.value)}
                    placeholder="理由を入力（必須）"
                    className="w-full bg-quest-bg border border-quest-border rounded-xl px-3 py-2 text-sm text-quest-text placeholder:text-quest-dim/50 focus:outline-none focus:border-red-400/30"
                  />
                  <button
                    onClick={handleSkip}
                    disabled={!skipReason.trim() || isSubmitting}
                    className="w-full text-xs border border-red-400/30 text-red-400/60 rounded-xl py-2.5 hover:bg-red-400/10 transition-colors disabled:opacity-40"
                  >
                    😴 スキップを申請する
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
