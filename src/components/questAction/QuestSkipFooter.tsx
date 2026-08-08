"use client";

import { SKIP_REASON_TEMPLATES } from "@/lib/skipReasonTemplates";

type Props = {
  showSkip: boolean;
  skipReason: string;
  isSubmitting: boolean;
  onShowSkip: () => void;
  onCancelSkip: () => void;
  onSkipReasonChange: (value: string) => void;
  onSkipSubmit: () => void;
};

export default function QuestSkipFooter({
  showSkip,
  skipReason,
  isSubmitting,
  onShowSkip,
  onCancelSkip,
  onSkipReasonChange,
  onSkipSubmit,
}: Props) {
  return (
    <div
      className="shrink-0 px-5 pt-2"
      style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom, 0px) + 0.75rem)" }}
    >
      <div className="border-t border-quest-border/40 mb-3" />

      {!showSkip ? (
        <button
          onClick={onShowSkip}
          className="w-full py-3 rounded-xl border border-red-400/40 text-red-400 text-sm font-medium flex items-center justify-center gap-2 hover:bg-red-400/10 active:scale-[0.99] transition-all"
        >
          😴 今日はスキップする
        </button>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-quest-dim text-center">スキップする理由をえらんでね</p>
          <div className="flex flex-wrap gap-1.5">
            {SKIP_REASON_TEMPLATES.map((t) => {
              const selected = skipReason === t.label;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onSkipReasonChange(t.label)}
                  disabled={isSubmitting}
                  aria-pressed={selected}
                  className={`px-3 py-2 rounded-full border text-xs transition-colors disabled:opacity-40 ${
                    selected
                      ? "border-red-400/60 bg-red-400/15 text-red-300"
                      : "border-quest-border text-quest-dim hover:border-red-400/40 hover:text-red-400"
                  }`}
                >
                  <span className="mr-1">{t.emoji}</span>
                  {t.label}
                </button>
              );
            })}
          </div>
          <input
            type="text"
            value={skipReason}
            onChange={(e) => onSkipReasonChange(e.target.value)}
            placeholder="理由を入力（必須）"
            className="w-full bg-quest-bg border border-red-400/30 rounded-xl px-3 py-2.5 text-sm text-quest-text placeholder:text-quest-dim/50 focus:outline-none focus:border-red-400/50"
          />
          <div className="flex gap-2">
            <button
              onClick={onCancelSkip}
              className="flex-none px-4 py-3 rounded-xl border border-quest-border text-quest-dim text-sm hover:bg-quest-border/20 transition-colors"
            >
              戻る
            </button>
            <button
              onClick={onSkipSubmit}
              disabled={!skipReason.trim() || isSubmitting}
              className="flex-1 py-3 rounded-xl border border-red-400/50 bg-red-400/10 text-red-400 text-sm font-medium hover:bg-red-400/20 transition-colors disabled:opacity-40"
            >
              {isSubmitting ? "申請中..." : "😴 スキップを申請する"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
