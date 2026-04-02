"use client";

import { useEffect, useState } from "react";
import { CATEGORY_LABEL } from "@/lib/constants";
import { calcActualXP } from "@/lib/xpRange";
import type { Category } from "@/types";
import LoadingSpinner from "@/components/LoadingSpinner";

type CompletedQuest = {
  id: string;
  templateId: string;
  status: "APPROVED" | "SKIPPED";
  date: string;
  approvedAt: string;
  comment: string | null;
  deadlineBonusEarned: boolean;
  photoUrl: string | null;
  child: { name: string; monsterName: string; side: string };
  template: {
    title: string;
    emoji: string;
    category: Category;
    isTemporary: boolean;
    photoBonus: boolean;
  };
};

const getTomorrowStr = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
};

export default function CompletedTodayPage() {
  const [quests, setQuests] = useState<CompletedQuest[]>([]);
  const [loading, setLoading] = useState(true);
  const [copyDates, setCopyDates] = useState<Record<string, string>>({});
  const [copyLoading, setCopyLoading] = useState<Record<string, boolean>>({});
  const [copyDone, setCopyDone] = useState<Record<string, boolean>>({});
  const [photoModal, setPhotoModal] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/quests/completed-today")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setQuests(data))
      .finally(() => setLoading(false));
  }, []);

  const approvedQuests = quests.filter((q) => q.status === "APPROVED");
  const skippedQuests = quests.filter((q) => q.status === "SKIPPED");
  const totalXp = approvedQuests.length;

  async function handleCopy(quest: CompletedQuest) {
    const targetDate = copyDates[quest.id] ?? getTomorrowStr();
    setCopyLoading((prev) => ({ ...prev, [quest.id]: true }));
    const res = await fetch(`/api/tasks/${quest.templateId}/copy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetDate }),
    });
    setCopyLoading((prev) => ({ ...prev, [quest.id]: false }));
    if (res.ok) {
      setCopyDone((prev) => ({ ...prev, [quest.id]: true }));
    }
  }

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-serif text-quest-gold text-2xl tracking-wider">
          🏆 今日の完了タスク
        </h1>
        <p className="text-quest-dim text-sm mt-1">
          {quests.length > 0
            ? `${approvedQuests.length}件完了${skippedQuests.length > 0 ? ` · ${skippedQuests.length}件スキップ` : ""} / 合計 +${totalXp}XP 獲得`
            : "今日はまだ完了したタスクがありません"}
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {quests.length === 0 && (
          <p className="text-quest-dim text-sm text-center py-12">
            承認済みのタスクが表示されます
          </p>
        )}
        {quests.map((quest) => {
          const isSkipped = quest.status === "SKIPPED";
          const cat = CATEGORY_LABEL[quest.template.category];
          const approvedTime = new Date(quest.approvedAt).toLocaleTimeString("ja-JP", {
            hour: "2-digit",
            minute: "2-digit",
          });
          const showCopyUI = isSkipped && quest.template.isTemporary;
          return (
            <div
              key={quest.id}
              className={`bg-quest-card border rounded-xl p-5 ${isSkipped ? "border-orange-500/40" : "border-quest-border"}`}
            >
              <div className="flex items-start gap-4">
                <div className="text-3xl">{quest.template.emoji}</div>
                <div className="flex-1">
                  <p className="text-sm text-quest-dim">
                    🧒 {quest.child.monsterName || quest.child.name}
                  </p>
                  <p className="text-base font-medium mt-1">{quest.template.title}</p>
                  <p className="text-xs text-quest-dim mt-1">
                    {cat.emoji} {cat.name}{isSkipped ? "" : ` · +${calcActualXP(quest.deadlineBonusEarned, quest.template.photoBonus, !!quest.photoUrl)}pt`}
                  </p>
                  {quest.photoUrl && (
                    <button
                      onClick={() => setPhotoModal(quest.photoUrl)}
                      className="flex items-center gap-2 text-sm text-quest-dim border border-quest-border rounded-xl px-4 py-2.5 mt-2 w-full justify-center hover:border-quest-gold/40 hover:text-quest-gold transition-colors"
                    >
                      📷 写真を見る
                    </button>
                  )}
                  {quest.comment && (
                    <p className="text-xs text-quest-dim mt-2 bg-quest-bg rounded-lg px-3 py-2">
                      💬 {quest.comment}
                    </p>
                  )}
                  {showCopyUI && (
                    <div className="mt-3 flex items-center gap-2">
                      {copyDone[quest.id] ? (
                        <span className="text-xs text-green-400">✓ 翌日に送りました</span>
                      ) : (
                        <>
                          <input
                            type="date"
                            className="text-xs bg-quest-bg border border-quest-border rounded-lg px-2 py-1 text-quest-text"
                            value={copyDates[quest.id] ?? getTomorrowStr()}
                            min={getTomorrowStr()}
                            onChange={(e) =>
                              setCopyDates((prev) => ({ ...prev, [quest.id]: e.target.value }))
                            }
                          />
                          <button
                            className="text-xs bg-orange-500/20 border border-orange-500/40 text-orange-300 rounded-lg px-3 py-1 hover:bg-orange-500/30 disabled:opacity-50"
                            disabled={copyLoading[quest.id]}
                            onClick={() => handleCopy(quest)}
                          >
                            {copyLoading[quest.id] ? "送信中…" : "📅 次の日に送る"}
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
                <div className="text-right text-xs text-quest-dim shrink-0">
                  {isSkipped ? (
                    <span className="text-orange-400 font-medium">⏭ スキップ</span>
                  ) : (
                    <span className="text-quest-gold font-medium">✓ 承認済み</span>
                  )}
                  <br />
                  {approvedTime}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 写真モーダル */}
      {photoModal && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setPhotoModal(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photoModal}
            alt="報告写真"
            className="max-w-full max-h-full object-contain rounded-xl cursor-pointer"
          />
        </div>
      )}
    </div>
  );
}
