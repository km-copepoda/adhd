"use client";

import type { StampCelebration } from "@/lib/stampCelebration";

type Props = {
  stampQueue: StampCelebration[];
  onClose: () => void;
};

export default function StampCelebrationOverlay({ stampQueue, onClose }: Props) {
  if (stampQueue.length === 0) return null;
  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-black/70 px-6"
      onClick={onClose}
    >
      <div className="flex flex-col items-center gap-4 select-none w-full max-w-sm">
        <p className="text-white font-bold text-xl">
          {stampQueue.length === 1 ? "承認されたよ！" : `${stampQueue.length}件 承認されたよ！`}
        </p>
        <div className={`flex flex-wrap justify-center gap-4 ${stampQueue.length === 1 ? "" : "w-full"}`}>
          {stampQueue.map((c) => (
            <div key={c.questId} className="flex flex-col items-center gap-1">
              <div className="text-[72px] animate-stamp-pop">{c.stamp}</div>
              <p className="text-white/70 text-xs text-center max-w-[80px] truncate">「{c.questTitle}」</p>
            </div>
          ))}
        </div>
        <p className="text-white/40 text-xs mt-2">タップで閉じる</p>
      </div>
    </div>
  );
}
