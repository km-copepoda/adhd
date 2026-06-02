"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/imageUtils";
import { CATEGORY_LABEL, CATEGORY_COLOR } from "@/lib/categories";
import { xpRangeLabel } from "@/lib/xp";
import { computeQuestSuccessDisplay } from "@/lib/questProgress";
import { fireCompletionConfetti } from "@/lib/confetti";
import QuestActionSuccess from "@/components/questAction/QuestActionSuccess";
import QuestPhotoUpload from "@/components/questAction/QuestPhotoUpload";
import QuestSkipFooter from "@/components/questAction/QuestSkipFooter";
import type { Category, QuestStatus } from "@/types";

export type SheetQuest = {
  id: string;
  status: QuestStatus;
  declaredToday?: boolean;
  template: {
    title: string;
    emoji: string;
    category: Category;
    photoBonus: boolean;
    taskStreaks: { currentStreak: number; bestStreak: number }[];
  };
};

type Props = {
  quest: SheetQuest;
  hasDeadline: boolean;
  questsCompleted: number;
  questsTotal: number;
  onReport: (questId: string, comment: string | null, photoUrl: string | null) => Promise<void>;
  onSkip: (questId: string, reason: string) => Promise<void>;
  onClose: () => void;
};

type SheetState = "idle" | "submitting" | "success-complete" | "success-skip";

export default function QuestActionSheet({ quest, hasDeadline, questsCompleted, questsTotal, onReport, onSkip, onClose }: Props) {
  const [comment, setComment] = useState("");
  const [showComment, setShowComment] = useState(false);
  const [showSkip, setShowSkip] = useState(false);
  const [skipReason, setSkipReason] = useState("");
  const [sheetState, setSheetState] = useState<SheetState>("idle");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const cat = CATEGORY_LABEL[quest.template.category];
  const streak = quest.template.taskStreaks[0]?.currentStreak ?? 0;
  const photoBonus = quest.template.photoBonus;

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setUploadError(null);
  }

  async function uploadPhoto(): Promise<string | null> {
    if (!photoFile) return null;
    const supabase = createClient();
    const compressed = await compressImage(photoFile);
    const ext = compressed.type === "image/webp" ? "webp" : "jpg";
    const path = `${quest.id}_${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("quest-photos").upload(path, compressed, {
      contentType: compressed.type,
    });
    if (error) {
      setUploadError("写真のアップロードに失敗しました");
      return null;
    }
    const { data } = supabase.storage.from("quest-photos").getPublicUrl(path);
    return data.publicUrl;
  }

  async function handleReport() {
    setSheetState("submitting");
    let photoUrl: string | null = null;
    if (photoFile) {
      photoUrl = await uploadPhoto();
      if (!photoUrl) {
        setSheetState("idle");
        return;
      }
    }
    await onReport(quest.id, comment || null, photoUrl);
    setSheetState("success-complete");
    setTimeout(() => onClose(), 3000);
  }

  async function handleSkip() {
    if (!skipReason.trim()) return;
    setSheetState("submitting");
    await onSkip(quest.id, skipReason);
    setSheetState("success-skip");
    setTimeout(() => onClose(), 3000);
  }

  const isSubmitting = sheetState === "submitting";
  const isSuccess = sheetState === "success-complete" || sheetState === "success-skip";

  // confetti effect on completion
  useEffect(() => {
    if (sheetState !== "success-complete") return;
    const { allDone } = computeQuestSuccessDisplay(questsCompleted, questsTotal);
    fireCompletionConfetti(allDone);
  }, [sheetState]); // eslint-disable-line react-hooks/exhaustive-deps

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
          <QuestActionSuccess
            variant={sheetState === "success-complete" ? "complete" : "skip"}
            questsCompleted={questsCompleted}
            questsTotal={questsTotal}
          />
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
                  <p className="text-base font-bold text-quest-text break-all">{quest.template.title}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-[11px] text-quest-dim">{cat.emoji} {cat.name}</span>
                    {streak >= 1 && (
                      <span className="text-[11px] text-orange-400">🔥{streak}日</span>
                    )}
                    {photoBonus && (
                      <span className="text-[11px] text-blue-400 border border-blue-400/30 rounded px-1">📷 写真+1pt</span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0 ml-2">
                  <p className="text-2xl font-black text-quest-gold leading-none">{xpRangeLabel(hasDeadline, photoBonus, !!quest.declaredToday)}</p>
                </div>
              </div>

              {/* Photo upload section — only shown when photoBonus is enabled */}
              {photoBonus && (
                <QuestPhotoUpload
                  photoPreview={photoPreview}
                  uploadError={uploadError}
                  onPhotoSelect={handlePhotoSelect}
                />
              )}

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
            <QuestSkipFooter
              showSkip={showSkip}
              skipReason={skipReason}
              isSubmitting={isSubmitting}
              onShowSkip={() => setShowSkip(true)}
              onCancelSkip={() => { setShowSkip(false); setSkipReason(""); }}
              onSkipReasonChange={setSkipReason}
              onSkipSubmit={handleSkip}
            />
          </>
        )}
      </div>
    </div>
  );
}
