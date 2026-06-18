"use client";

import { CATEGORY_LABEL, CATEGORY_COLOR } from "@/lib/categories";
import { DECLARATION_BONUS_XP } from "@/lib/declaration";
import { calcActualXP } from "@/lib/xp";
import { displayRejectionReason } from "@/lib/rejectionReason";
import type { Quest } from "@/hooks/useChildQuests";

type Props = {
  quest: Quest;
  onOpen: (quest: Quest) => void;
  onDeclare: (questId: string) => void;
};

export default function QuestListItem({ quest, onOpen, onDeclare }: Props) {
  const cat = CATEGORY_LABEL[quest.template.category];
  const xp = calcActualXP(
    quest.deadlineBonusEarned,
    quest.template.photoBonus,
    !!quest.photoUrl,
    quest.declaredToday,
  );
  const isTemporary = quest.template.isTemporary;
  const taskStreak = quest.template.taskStreaks[0]?.currentStreak ?? 0;
  const isApproved = quest.status === "APPROVED";
  const isReported = quest.status === "REPORTED";
  const isSkipped = quest.status === "SKIPPED";
  const isSkipReported = quest.status === "SKIP_REPORTED";
  const isRejected = quest.status === "REJECTED";
  const isDone = isApproved || isReported || isSkipped || isSkipReported;
  const isIdleEligible = !isDone && quest.eligibleForDeclaration;

  return (
    <div>
      <div
        onClick={() => (!isDone || isRejected) && onOpen(quest)}
        className={`relative bg-quest-card border rounded-xl overflow-hidden transition-all ${
          isRejected
            ? "border-red-400/40 cursor-pointer hover:border-red-400/60 active:scale-[0.99]"
            : isDone
            ? "border-quest-border opacity-60"
            : "border-quest-border cursor-pointer hover:border-quest-gold/30 active:scale-[0.99]"
        }`}
      >
        <div className="flex items-center gap-3 p-4">
          {/* Icon */}
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-xl shrink-0"
            style={{ backgroundColor: `${CATEGORY_COLOR[quest.template.category]}15` }}
          >
            {quest.template.emoji}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-1.5">
              <p className="text-sm font-medium break-all">{quest.template.title}</p>
              {isTemporary && (
                <span className="text-[9px] text-amber-400/70 border border-amber-400/30 rounded px-1">
                  一時
                </span>
              )}
              {quest.template.createdBy === "CHILD" && (
                <span className="text-[9px] text-purple-400/70 border border-purple-400/30 rounded px-1">
                  仮
                </span>
              )}
              {taskStreak >= 1 && (
                <span className="text-[9px] text-orange-400 border border-orange-400/30 rounded px-1 shrink-0">
                  🔥{taskStreak}日
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] text-quest-dim">
                {cat.emoji} {cat.name}
              </span>
            </div>
          </div>

          {/* XP + Status */}
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span className={`text-xs font-bold ${
              isSkipped || isSkipReported
                ? "text-quest-dim line-through"
                : isApproved
                ? "text-quest-gold"
                : isReported
                ? "text-quest-gold/50"
                : "text-quest-gold"
            }`}>
              +{xp}XP
            </span>

            {isApproved ? (
              <div className="flex flex-col items-end gap-0.5">
                {quest.approvalStamp ? (
                  <div className="w-9 h-9 rounded-full bg-quest-gold/10 border border-quest-gold/30 flex items-center justify-center text-xl animate-pulse-once">
                    {quest.approvalStamp}
                  </div>
                ) : (
                  <div className="w-7 h-7 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 text-sm">✓</div>
                )}
                <span className="text-[9px] text-green-400/70">承認済み</span>
              </div>
            ) : isReported ? (
              <div className="flex flex-col items-end gap-0.5">
                <div className="w-7 h-7 rounded-full bg-green-500/10 flex items-center justify-center text-green-400/50 text-sm">✓</div>
                <span className="text-[9px] text-quest-dim">確認中...</span>
              </div>
            ) : isRejected ? (
              <div className="flex flex-col items-end gap-0.5">
                <div className="w-7 h-7 rounded-full bg-red-400/10 flex items-center justify-center text-red-400 text-sm">✕</div>
                <span className="text-[9px] text-red-400/70">差し戻し</span>
              </div>
            ) : isSkipReported ? (
              <div className="flex flex-col items-end gap-0.5">
                <div className="w-7 h-7 rounded-full bg-red-400/10 flex items-center justify-center text-red-400/50 text-sm">−</div>
                <span className="text-[9px] text-quest-dim">申請中...</span>
              </div>
            ) : isSkipped ? (
              <div className="flex flex-col items-end gap-0.5">
                <div className="w-7 h-7 rounded-full bg-quest-border/30 flex items-center justify-center text-quest-dim text-sm">−</div>
                <span className="text-[9px] text-quest-dim">スキップ</span>
              </div>
            ) : (
              <div className="w-7 h-7 rounded-full border-2 border-quest-border/60" />
            )}
          </div>
        </div>
      </div>

      {/* 「今日やる宣言」 — 3日以上アイドルなタスクにだけ表示 */}
      {isIdleEligible && (
        <div className="bg-quest-card border border-quest-gold/30 border-t-0 rounded-b-xl px-4 py-3 flex items-center gap-2">
          <span className="text-xl shrink-0">⏰</span>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-quest-gold/80 font-medium">
              {quest.idleDays}日やってないよ
            </p>
            <p className="text-[10px] text-quest-dim mt-0.5">
              {quest.declaredToday
                ? `今日やるって決めたね！完了で +${DECLARATION_BONUS_XP}XPボーナス`
                : "「今日やる」って決めると、完了したときボーナスがもらえる"}
            </p>
          </div>
          {quest.declaredToday ? (
            <span className="text-[10px] text-green-400 border border-green-500/40 rounded-lg px-2 py-1 shrink-0 bg-green-500/10">
              ✓ 宣言済み
            </span>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeclare(quest.id);
              }}
              className="text-[10px] text-green-400 border border-green-500/40 rounded-lg px-2 py-1 shrink-0 hover:bg-green-500/10 active:scale-95 transition-all"
            >
              今日やる（完了で +{DECLARATION_BONUS_XP}）
            </button>
          )}
        </div>
      )}

      {/* 差し戻し理由バナー（システム由来の DUPLICATE_PENDING_CLEANUP / STALE_CARRYOVER_CLEANUP は非表示） */}
      {isRejected && displayRejectionReason(quest.rejectionReason) && (
        <div className="bg-red-400/5 border border-red-400/20 border-t-0 rounded-b-xl px-4 py-3 flex items-start gap-2">
          <span className="text-red-400 text-xs mt-0.5 shrink-0">⚠</span>
          <div>
            <p className="text-xs text-red-400/80 font-medium">差し戻し理由</p>
            <p className="text-xs text-red-300/70 mt-0.5">{displayRejectionReason(quest.rejectionReason)}</p>
            <p className="text-[10px] text-quest-dim mt-1">タップしてもう一度報告してね</p>
          </div>
        </div>
      )}
    </div>
  );
}
