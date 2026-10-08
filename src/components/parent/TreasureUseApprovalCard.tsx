"use client";

// #151: 承認センターに合流する「ごほうび使用申請」カード。
// クエストカードと違いカード全体クリックでの承認はしない（誤タップ事故防止）。承認/却下ボタンのみ。

import { formatReportedTime } from "@/lib/date";
import { RARITY_BADGE_CLASS, formatChildRarity, type TreasureRarity } from "@/lib/treasureRarity";

export type PendingTreasureUse = {
  id: string;
  kind: "treasure_use";
  requestedAt: string;
  child: { name: string; monsterName: string | null; side: string | null };
  item: { id: string; title: string; rarity: TreasureRarity } | null;
};

type Props = {
  item: PendingTreasureUse;
  onApprove: (item: PendingTreasureUse) => void;
  onReject: (item: PendingTreasureUse) => void;
};

export default function TreasureUseApprovalCard({ item, onApprove, onReject }: Props) {
  return (
    <div className="bg-quest-card border border-quest-gold/20 rounded-xl p-5">
      <div className="flex items-start gap-4 mb-4">
        <div className="text-3xl">🎁</div>
        <div className="flex-1">
          <p className="text-sm text-quest-dim">
            🧒 {item.child.monsterName || item.child.name} からのごほうび使用申請
            <span className="ml-2 text-xs opacity-60">🕐 {formatReportedTime(item.requestedAt)}</span>
          </p>
          <p className="text-base font-medium mt-1">{item.item?.title ?? "ごほうび"}</p>
          {item.item && (
            <span className={`inline-block mt-1 text-[11px] px-2 py-0.5 rounded ${RARITY_BADGE_CLASS[item.item.rarity]}`}>
              {formatChildRarity(item.item.rarity)}
            </span>
          )}
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => onApprove(item)}
          className="flex-1 text-sm py-2 text-center rounded-xl btn-gold"
        >
          ✓ 使用を承認
        </button>
        <button
          onClick={() => onReject(item)}
          className="text-quest-dim text-sm border border-quest-border rounded-xl px-4 py-2 hover:border-red-400/30 hover:text-red-400"
        >
          却下
        </button>
      </div>
    </div>
  );
}
