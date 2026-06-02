"use client";

import { CATEGORY_LABEL, CATEGORY_COLOR } from "@/lib/categories";
import { REBIRTH_THRESHOLD } from "@/lib/evolution";

type XpInfo = {
  xpToEvolve: number | null;
  ptNeeded: number | null;
  evolutionWeights: { STUDY: number; STAMINA: number; LIFE: number } | null;
};

type Props = {
  evolutionStage: number;
  rebirthPending: boolean;
  xpInfo: XpInfo;
  total: number;
  pendingTotal: number;
  onRebirthClick: () => void;
};

export default function EvolutionProgressCard({
  evolutionStage,
  rebirthPending,
  xpInfo,
  total,
  pendingTotal,
  onRebirthClick,
}: Props) {
  const stageLabel =
    evolutionStage === 0 ? "たまご" :
    evolutionStage >= 3 ? "最終形態" :
    `stage ${evolutionStage} / 3`;
  const nextLabel =
    evolutionStage === 0 ? "孵化" :
    xpInfo.xpToEvolve !== null ? "進化" : "転生";

  if (rebirthPending) {
    return (
      <div className="bg-quest-card border border-purple-500/50 rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex gap-2">
            {[1, 2, 3].map((s) => (
              <div key={s} className="w-3 h-3 rounded-full bg-quest-gold" />
            ))}
          </div>
          <span className="text-xs text-purple-400/70">{stageLabel}</span>
        </div>
        <div className="h-4 bg-quest-border rounded-full overflow-hidden mb-3">
          <div
            className="h-full w-full bg-gradient-to-r from-purple-700 to-purple-400 animate-shimmer"
          />
        </div>
        <p className="text-purple-400 font-bold text-sm mb-3">
          ✨ 転生の準備ができた！
        </p>
        <button
          onClick={onRebirthClick}
          className="w-full py-3 rounded-xl font-bold text-white text-base"
          style={{
            background: "linear-gradient(135deg, #7c3aed, #a855f7)",
            animation: "rebirthPulse 1.5s ease-in-out infinite",
          }}
        >
          ✨ 転生する！
        </button>
        <style>{`
          @keyframes rebirthPulse {
            0%, 100% { box-shadow: 0 0 0 0 rgba(139,92,246,0.4); }
            50% { box-shadow: 0 0 0 8px rgba(139,92,246,0); }
          }
        `}</style>
      </div>
    );
  }

  if (xpInfo.xpToEvolve !== null) {
    const approvedPct = Math.min(100, (total / xpInfo.xpToEvolve) * 100);
    const pendingPct = Math.min(100 - approvedPct, (pendingTotal / xpInfo.xpToEvolve) * 100);
    return (
      <div className="bg-quest-card border border-quest-border rounded-xl p-4 mb-4">
        {/* Stage dots + label */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex gap-2">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`w-3 h-3 rounded-full ${evolutionStage >= s ? "bg-quest-gold" : "bg-quest-border"}`}
              />
            ))}
          </div>
          <span className="text-xs text-quest-dim">{stageLabel}</span>
        </div>
        {/* Progress bar */}
        <div className="h-4 bg-quest-border rounded-full overflow-hidden flex mb-2">
          <div
            className="h-full bg-gradient-to-r from-quest-gold-dark to-quest-gold rounded-l-full animate-shimmer"
            style={{ width: `${approvedPct}%` }}
          />
          {pendingPct > 0 && (
            <div
              className="h-full"
              style={{
                width: `${pendingPct}%`,
                background: "rgba(251,191,36,0.25)",
                borderLeft: "1px dashed rgba(251,191,36,0.5)",
              }}
            />
          )}
        </div>
        {/* Pt info */}
        <div className="flex justify-between items-baseline">
          <p className="text-quest-gold font-bold text-sm">
            あと {Math.max(0, xpInfo.ptNeeded!)} pt で{nextLabel}！
          </p>
          <span className="text-[11px] text-quest-dim">
            {total} / {xpInfo.xpToEvolve} pt
            {pendingTotal > 0 && <span className="ml-1">+ {pendingTotal}(仮)</span>}
          </span>
        </div>
        {/* Evolution path weights */}
        {xpInfo.evolutionWeights && (
          <div className="mt-3 flex gap-2 pt-3 border-t border-quest-border/50">
            {(["STUDY", "STAMINA", "LIFE"] as const).map((path) => (
              <div key={path} className="flex-1 text-center">
                <p className="text-xs" style={{ color: CATEGORY_COLOR[path] }}>
                  {CATEGORY_LABEL[path].emoji} {CATEGORY_LABEL[path].name}
                </p>
                <p className="text-quest-gold font-bold text-sm">
                  {Math.round(xpInfo.evolutionWeights![path] * 100)}%
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  const rebirthPct = Math.min(100, (total / REBIRTH_THRESHOLD) * 100);
  const rebirthPendingPct = Math.min(100 - rebirthPct, (pendingTotal / REBIRTH_THRESHOLD) * 100);
  return (
    <div className="bg-quest-card border border-quest-border rounded-xl p-4 mb-4">
      {/* Stage dots + label */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className="w-3 h-3 rounded-full bg-quest-gold" />
          ))}
        </div>
        <span className="text-xs text-quest-dim">{stageLabel}</span>
      </div>
      {/* Progress bar */}
      <div className="h-4 bg-quest-border rounded-full overflow-hidden flex mb-2">
        <div
          className="h-full bg-gradient-to-r from-purple-700 to-purple-400 rounded-l-full animate-shimmer"
          style={{ width: `${rebirthPct}%` }}
        />
        {rebirthPendingPct > 0 && (
          <div
            className="h-full"
            style={{
              width: `${rebirthPendingPct}%`,
              background: "rgba(139,92,246,0.25)",
              borderLeft: "1px dashed rgba(139,92,246,0.5)",
            }}
          />
        )}
      </div>
      {/* Pt info */}
      <div className="flex justify-between items-baseline">
        <p className="text-purple-400 font-bold text-sm">
          あと {Math.max(0, REBIRTH_THRESHOLD - total)} pt で転生！
        </p>
        <span className="text-[11px] text-quest-dim">
          {total} / {REBIRTH_THRESHOLD} pt
          {pendingTotal > 0 && <span className="ml-1">+ {pendingTotal}(仮)</span>}
        </span>
      </div>
    </div>
  );
}
