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
  onReport: (questId: string, comment: string | null) => Promise<void>;
  onSkip: (questId: string, reason: string) => Promise<void>;
  onClose: () => void;
};

type SheetState = "idle" | "submitting" | "success-complete" | "success-skip";

export default function QuestActionSheet({ quest, onReport, onSkip, onClose }: Props) {
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

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" />

      {/* Sheet */}
      <div
        className="relative bg-quest-card rounded-t-2xl px-5 pt-4 pb-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="w-10 h-1 bg-quest-border rounded-full mx-auto mb-5" />

        {/* Quest info header */}
        <div className="flex items-center gap-3 mb-6">
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

        {/* Success state */}
        {(sheetState === "success-complete" || sheetState === "success-skip") ? (
          <div className="text-center py-8">
            <p className="text-5xl mb-3">
              {sheetState === "success-complete" ? "🎉" : "😴"}
            </p>
            <p className="text-xl font-bold text-quest-gold">
              {sheetState === "success-complete"
                ? `+${xp}pt ゲット！`
                : "スキップを申請したよ"}
            </p>
            <p className="text-xs text-quest-dim mt-2">
              {sheetState === "success-complete"
                ? "親の確認後にポイント確定"
                : "親が確認するよ"}
            </p>
          </div>
        ) : (
          <>
            {/* ── Complete button ── */}
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
                className="w-full bg-quest-bg border border-quest-border rounded-xl px-3 py-2 text-sm text-quest-text placeholder:text-quest-dim/50 focus:outline-none focus:border-quest-gold/30 resize-none h-16 mt-1 mb-1"
              />
            )}

            {/* Divider */}
            <div className="border-t border-quest-border/40 my-3" />

            {/* ── Skip section ── */}
            <button
              onClick={() => setShowSkip((v) => !v)}
              className="w-full text-xs text-quest-dim/50 py-1 flex items-center justify-center gap-1"
            >
              😴 今日はできない場合
              <span className="text-[10px] opacity-60">{showSkip ? "▲" : "▼"}</span>
            </button>

            {showSkip && (
              <div className="mt-3 space-y-2">
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
          </>
        )}
      </div>
    </div>
  );
}
