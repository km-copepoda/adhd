"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/imageUtils";
import { DIFFICULTY_LABEL, CATEGORY_LABEL, CATEGORY_COLOR } from "@/lib/constants";
import type { Category, Difficulty, QuestStatus } from "@/types";

export type SheetQuest = {
  id: string;
  status: QuestStatus;
  template: {
    title: string;
    emoji: string;
    category: Category;
    difficulty: Difficulty;
    photoBonus: boolean;
    taskStreaks: { currentStreak: number; bestStreak: number }[];
  };
};

type Props = {
  quest: SheetQuest;
  questsCompleted: number;
  questsTotal: number;
  onReport: (questId: string, comment: string | null, photoUrl: string | null) => Promise<void>;
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
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const cat = CATEGORY_LABEL[quest.template.category];
  const diff = DIFFICULTY_LABEL[quest.template.difficulty];
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
                <p className="text-2xl font-black text-quest-gold mb-1">クエスト報告完了！</p>
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
                    {photoBonus && (
                      <span className="text-[11px] text-blue-400 border border-blue-400/30 rounded px-1">📷 写真+1pt</span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0 ml-2">
                  <p className="text-2xl font-black text-quest-gold leading-none">+1〜3</p>
                  <p className="text-[10px] text-quest-dim mt-0.5">pt</p>
                </div>
              </div>

              {/* Photo upload section — only shown when photoBonus is enabled */}
              {photoBonus && (
                <div className="mb-3">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className={`w-full rounded-xl border-2 border-dashed transition-colors py-3 flex flex-col items-center gap-1 ${
                      photoPreview
                        ? "border-blue-400/50 bg-blue-400/5"
                        : "border-blue-400/40 bg-blue-400/5"
                    }`}
                  >
                    {photoPreview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photoPreview} alt="プレビュー" className="max-h-40 rounded-lg object-contain" />
                    ) : (
                      <>
                        <span className="text-2xl">📷</span>
                        <span className="text-xs text-quest-dim">写真を追加（+1pt）</span>
                      </>
                    )}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handlePhotoSelect}
                  />
                  {uploadError && (
                    <p className="text-xs text-red-400 mt-1 text-center">{uploadError}</p>
                  )}
                </div>
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
            <div
              className="shrink-0 px-5 pt-2"
              style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom, 0px) + 0.75rem)" }}
            >
              <div className="border-t border-quest-border/40 mb-3" />

              {!showSkip ? (
                <button
                  onClick={() => setShowSkip(true)}
                  className="w-full py-3 rounded-xl border border-red-400/40 text-red-400 text-sm font-medium flex items-center justify-center gap-2 hover:bg-red-400/10 active:scale-[0.99] transition-all"
                >
                  😴 今日はスキップする
                </button>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-quest-dim text-center">スキップする理由を入力してね</p>
                  <input
                    type="text"
                    value={skipReason}
                    onChange={(e) => setSkipReason(e.target.value)}
                    placeholder="理由を入力（必須）"
                    className="w-full bg-quest-bg border border-red-400/30 rounded-xl px-3 py-2.5 text-sm text-quest-text placeholder:text-quest-dim/50 focus:outline-none focus:border-red-400/50"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setShowSkip(false); setSkipReason(""); }}
                      className="flex-none px-4 py-3 rounded-xl border border-quest-border text-quest-dim text-sm hover:bg-quest-border/20 transition-colors"
                    >
                      戻る
                    </button>
                    <button
                      onClick={handleSkip}
                      disabled={!skipReason.trim() || isSubmitting}
                      className="flex-1 py-3 rounded-xl border border-red-400/50 bg-red-400/10 text-red-400 text-sm font-medium hover:bg-red-400/20 transition-colors disabled:opacity-40"
                    >
                      {isSubmitting ? "申請中..." : "😴 スキップを申請する"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
