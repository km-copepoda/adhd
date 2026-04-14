"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { MonsterMiniData } from "@/lib/monster-mini";
import { REBIRTH_THRESHOLD } from "@/lib/evolution";
import MonsterImageModal from "@/components/MonsterImageModal";

type Props = {
  data: MonsterMiniData;
  childName: string;
};

export default function MonsterMiniCard({ data, childName }: Props) {
  const { image, monsterName, stageLabel, ptCurrent, ptNeeded, ptToEvolve, isRebirth, rebirthThreshold } = data;
  const [showModal, setShowModal] = useState(false);

  const progressPct = isRebirth
    ? Math.min(100, (ptCurrent / rebirthThreshold) * 100)
    : ptToEvolve !== null
    ? Math.min(100, (ptCurrent / ptToEvolve) * 100)
    : 100;

  const nextLabel = isRebirth ? "転生" : stageLabel === "たまご" ? "孵化" : "進化";
  const progressColor = isRebirth
    ? "linear-gradient(90deg, #7e22ce, #a855f7)"
    : "linear-gradient(90deg, #b45309, #fbbf24)";

  return (
    <>
      <div className="bg-quest-card border border-quest-border rounded-xl p-3 mb-5 flex items-center gap-3 hover:border-quest-gold/30 active:scale-[0.99] transition-all">
        {/* Monster image — タップでモーダル表示 */}
        <button
          type="button"
          aria-label={`${monsterName}の画像を拡大`}
          onClick={() => setShowModal(true)}
          className="w-16 h-16 shrink-0 rounded-xl flex items-center justify-center overflow-hidden focus:outline-none"
          style={{ background: isRebirth ? "rgba(139,92,246,0.1)" : "rgba(251,191,36,0.08)" }}
        >
          <Image
            src={image}
            alt={monsterName}
            width={64}
            height={64}
            className="w-full h-full object-contain"
          />
        </button>

        {/* Info — タップでモンスター詳細ページへ */}
        <Link href="/app/child/monster" className="flex-1 min-w-0 flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-1.5 mb-0.5">
              <p className="text-sm font-medium text-quest-text truncate">{childName}</p>
              <span className="text-[10px] text-quest-dim shrink-0">{stageLabel}</span>
            </div>
            <p className="text-xs text-quest-gold truncate mb-1.5">{monsterName}</p>

            {/* XP progress bar */}
            <div className="h-1.5 bg-quest-border rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${progressPct}%`, background: progressColor }}
              />
            </div>
            <p className="text-[10px] text-quest-dim mt-0.5">
              {isRebirth
                ? `あと ${Math.max(0, rebirthThreshold - ptCurrent)} pt で${nextLabel}`
                : ptNeeded !== null
                ? `あと ${Math.max(0, ptNeeded)} pt で${nextLabel}`
                : null}
            </p>
          </div>

          {/* Arrow */}
          <span className="text-quest-dim/40 text-xs shrink-0">›</span>
        </Link>
      </div>

      {showModal && (
        <MonsterImageModal
          image={image}
          monsterName={monsterName}
          stageLabel={stageLabel}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}
