"use client";

import { CATEGORY_LABEL, CATEGORY_COLOR } from "@/lib/categories";
import { REBIRTH_THRESHOLD } from "@/lib/evolution";

type ParamKey = "STUDY" | "STAMINA" | "LIFE";

type Param = {
  key: ParamKey;
  value: number;
  pending: number;
};

type Props = {
  params: Param[];
  xpToEvolve: number | null;
};

export default function ParameterCardList({ params, xpToEvolve }: Props) {
  return (
    <div className="flex flex-col gap-3">
      {params.map((p) => {
        const label = CATEGORY_LABEL[p.key];
        const color = CATEGORY_COLOR[p.key];
        const threshold = xpToEvolve ?? REBIRTH_THRESHOLD;
        const approvedPct = Math.min(100, Math.round((p.value / threshold) * 100));
        const pendingPct = Math.min(100 - approvedPct, Math.round((p.pending / threshold) * 100));

        return (
          <div
            key={p.key}
            className="bg-quest-card border border-quest-border rounded-xl p-4 relative overflow-hidden"
          >
            {/* Left color stripe */}
            <div
              className="absolute left-0 top-0 bottom-0 w-1"
              style={{ backgroundColor: color }}
            />
            <div className="flex items-center gap-3 pl-2">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center text-lg"
                style={{ backgroundColor: `${color}15` }}
              >
                {label.emoji}
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-baseline">
                  <span className="text-sm">{label.name}</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-lg font-bold" style={{ color }}>
                      {p.value} <span className="text-xs font-normal text-quest-dim">pt</span>
                    </span>
                    {p.pending > 0 && (
                      <span className="text-xs text-quest-dim">+ {p.pending} pt(仮)</span>
                    )}
                  </div>
                </div>
                <div className="mt-2 h-1.5 bg-quest-border rounded-full overflow-hidden flex">
                  {/* 承認済みポイント */}
                  <div
                    className="h-full rounded-l-full transition-all animate-shimmer"
                    style={{
                      width: `${approvedPct}%`,
                      background: `linear-gradient(90deg, ${color}80, ${color})`,
                    }}
                  />
                  {/* 仮ポイント（薄い色） */}
                  {pendingPct > 0 && (
                    <div
                      className="h-full transition-all"
                      style={{
                        width: `${pendingPct}%`,
                        background: `${color}40`,
                        borderLeft: `1px dashed ${color}80`,
                      }}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
