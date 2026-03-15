"use client";

import { useEffect, useState } from "react";
import { CATEGORY_LABEL, XP_MAP } from "@/lib/constants";
import type { Category, Difficulty } from "@/types";

type CompletedQuest = {
  id: string;
  status: "APPROVED" | "SKIPPED";
  date: string;
  approvedAt: string;
  comment: string | null;
  child: { name: string; monsterName: string; side: string };
  template: {
    title: string;
    emoji: string;
    category: Category;
    difficulty: Difficulty;
  };
};

export default function CompletedTodayPage() {
  const [quests, setQuests] = useState<CompletedQuest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/quests/completed-today")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setQuests(data))
      .finally(() => setLoading(false));
  }, []);

  const approvedQuests = quests.filter((q) => q.status === "APPROVED");
  const skippedQuests = quests.filter((q) => q.status === "SKIPPED");
  const totalXp = approvedQuests.reduce((sum, q) => sum + XP_MAP[q.template.difficulty], 0);

  if (loading) {
    return <div className="text-quest-dim">読み込み中...</div>;
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
          const xp = XP_MAP[quest.template.difficulty];
          const approvedTime = new Date(quest.approvedAt).toLocaleTimeString("ja-JP", {
            hour: "2-digit",
            minute: "2-digit",
          });
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
                    {cat.emoji} {cat.name}{isSkipped ? "" : ` · +${xp}XP`}
                  </p>
                  {quest.comment && (
                    <p className="text-xs text-quest-dim mt-2 bg-quest-bg rounded-lg px-3 py-2">
                      💬 {quest.comment}
                    </p>
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
    </div>
  );
}
