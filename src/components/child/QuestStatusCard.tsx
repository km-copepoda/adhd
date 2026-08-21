import type { ReactNode } from "react";
import type { TreasureCountdown } from "@/lib/treasureCountdown";

interface Props {
  completedCount: number;
  totalCount: number;
  provisionalPt: number;
  confirmedPt: number;
  countdown: TreasureCountdown;
  /** 宝箱ストックUI（TreasureStock variant="card" 等）をこのカード内のスロットに描画する */
  children?: ReactNode;
}

const COUNTDOWN_STYLES: Record<Exclude<TreasureCountdown["kind"], "none">, string> = {
  all_done: "bg-amber-900/20 border-amber-500/40 text-amber-300",
  to_streak: "bg-purple-900/20 border-purple-500/30 text-purple-300",
  to_all_complete: "bg-yellow-900/20 border-yellow-500/30 text-yellow-300",
};

const COUNTDOWN_ICONS: Record<Exclude<TreasureCountdown["kind"], "none">, string> = {
  all_done: "🎉",
  to_streak: "🎁",
  to_all_complete: "✨",
};

export default function QuestStatusCard({
  completedCount,
  totalCount,
  provisionalPt,
  confirmedPt,
  countdown,
  children,
}: Props) {
  const progressWidth = totalCount > 0 ? `${(completedCount / totalCount) * 100}%` : "0%";
  const showPt = provisionalPt > 0 || confirmedPt > 0;

  return (
    <div className="bg-quest-card border border-quest-border rounded-xl p-3 mb-4">
      <div className="flex justify-between items-start gap-3">
        <div className="flex-1">
          <p className="text-quest-dim text-xs">
            {completedCount} / {totalCount} 完了
          </p>
          {showPt && (
            <div className="flex gap-3 mt-1">
              {provisionalPt > 0 && (
                <span className="text-[10px] text-quest-dim" data-testid="quest-provisional-pt">
                  仮 <span className="text-quest-gold/60 font-bold">{provisionalPt}</span> pt
                </span>
              )}
              {confirmedPt > 0 && (
                <span className="text-[10px] text-quest-dim" data-testid="quest-confirmed-pt">
                  本 <span className="text-quest-gold font-bold">{confirmedPt}</span> pt
                </span>
              )}
            </div>
          )}
        </div>
        {children && <div className="shrink-0">{children}</div>}
      </div>

      <div className="mt-2 h-1.5 bg-quest-border rounded-full overflow-hidden">
        <div
          data-testid="quest-progress-bar"
          className="h-full bg-gradient-to-r from-quest-gold-dark to-quest-gold rounded-full transition-all"
          style={{ width: progressWidth }}
        />
      </div>

      {countdown.kind !== "none" && (
        <div
          className={`mt-3 flex items-center gap-2 rounded-xl border px-3 py-2 text-xs ${COUNTDOWN_STYLES[countdown.kind]}`}
          data-testid="treasure-countdown"
        >
          <span>{COUNTDOWN_ICONS[countdown.kind]}</span>
          <span className="flex-1 font-bold">{countdown.text}</span>
        </div>
      )}
    </div>
  );
}
