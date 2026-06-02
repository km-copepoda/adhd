"use client";

import { CATEGORY_LABEL } from "@/lib/categories";
import { calcActualXP } from "@/lib/xp";
import type { HistoryItem } from "@/hooks/useHistoryData";

type HistoryItemCardProps = {
  item: HistoryItem;
  showChildName: boolean;
  onPhotoClick: (url: string) => void;
};

export default function HistoryItemCard({ item, showChildName, onPhotoClick }: HistoryItemCardProps) {
  const isApproved = item.status === "APPROVED";
  const isSkipped = item.status === "SKIPPED";
  const cat = CATEGORY_LABEL[item.template.category];
  const childName = item.child?.monsterName || item.child?.name || "不明";

  return (
    <div
      className={[
        "bg-quest-card border rounded-xl p-5",
        isApproved
          ? "border-quest-border"
          : isSkipped
          ? "border-orange-500/40"
          : "border-quest-dim/20 opacity-60",
      ].join(" ")}
    >
      <div className="flex items-start gap-4">
        <div className="text-3xl">{item.template.emoji}</div>
        <div className="flex-1">
          {showChildName && (
            <p className="text-sm text-quest-dim">🧒 {childName}</p>
          )}
          <p className="text-base font-medium mt-1">
            {item.template.title}
          </p>
          <p className="text-xs text-quest-dim mt-1">
            {cat.emoji} {cat.name}
            {isApproved ? ` · +${calcActualXP(item.deadlineBonusEarned, !!item.template.photoBonus, !!item.photoUrl)}pt` : ""}
          </p>
          {item.photoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.photoUrl}
              alt="報告写真"
              className="w-full h-32 object-cover rounded-xl mt-2 cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => item.photoUrl && onPhotoClick(item.photoUrl)}
            />
          )}
          {item.comment && (
            <p className="text-xs text-quest-dim mt-2 bg-quest-bg rounded-lg px-3 py-2">
              💬 {item.comment}
            </p>
          )}
        </div>
        <div className="text-right text-xs text-quest-dim shrink-0">
          {isApproved ? (
            <span className="text-quest-gold font-medium">✓ 完了</span>
          ) : isSkipped ? (
            <span className="text-orange-400 font-medium">⏭ スキップ</span>
          ) : (
            <span className="text-quest-dim font-medium">— 未対応</span>
          )}
          {item.approvedAt && (
            <>
              <br />
              {new Date(item.approvedAt).toLocaleTimeString("ja-JP", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
