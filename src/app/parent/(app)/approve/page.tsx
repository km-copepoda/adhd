"use client";

import { useEffect, useState } from "react";
import { CATEGORY_LABEL, XP_MAP } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import type { Category, Difficulty, QuestStatus } from "@/types";

type PendingQuest = {
  id: string;
  date: string;
  status: QuestStatus;
  comment: string | null;
  reportedAt: string;
  child: { name: string; monsterName: string; side: string };
  template: {
    title: string;
    emoji: string;
    category: Category;
    difficulty: Difficulty;
  };
};

export default function ApprovePage() {
  const [quests, setQuests] = useState<PendingQuest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPending();

    const supabase = createClient();
    const channel = supabase
      .channel("approve-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "QuestInstance" }, refreshPending)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  async function refreshPending() {
    const res = await fetch("/api/approve/pending");
    if (res.ok) setQuests(await res.json());
  }

  async function fetchPending() {
    const res = await fetch("/api/approve/pending");
    if (res.ok) setQuests(await res.json());
    setLoading(false);
  }

  async function handleAction(id: string, action: "approve" | "reject") {
    await fetch(`/api/approve/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    fetchPending();
  }

  async function handleBulkApprove() {
    await Promise.all(
      quests.map((q) =>
        fetch(`/api/approve/${q.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "approve" }),
        })
      )
    );
    fetchPending();
  }

  if (loading) {
    return <div className="text-quest-dim">読み込み中...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="font-serif text-quest-gold text-2xl tracking-wider">
            ✅ 承認センター
          </h1>
          <p className="text-quest-dim text-sm mt-1">
            {quests.length}件の報告が承認待ちです
          </p>
        </div>
        {quests.length > 0 && (
          <button onClick={handleBulkApprove} className="btn-gold text-sm">
            ✓ まとめて承認
          </button>
        )}
      </div>

      <div className="flex flex-col gap-4">
        {quests.length === 0 && (
          <p className="text-quest-dim text-sm text-center py-12">
            承認待ちの報告はありません
          </p>
        )}
        {quests.map((quest) => {
          const cat = CATEGORY_LABEL[quest.template.category];
          const xp = XP_MAP[quest.template.difficulty];
          const isSkipRequest = quest.status === "SKIP_REPORTED";
          return (
            <div
              key={quest.id}
              onClick={() => handleAction(quest.id, "approve")}
              className={`bg-quest-card border rounded-xl p-5 cursor-pointer transition-colors ${
                isSkipRequest
                  ? "border-red-400/20 hover:border-red-400/40"
                  : "border-quest-border hover:border-quest-gold/30"
              }`}
            >
              <div className="flex items-start gap-4 mb-4">
                <div className="text-3xl">{isSkipRequest ? "😴" : quest.template.emoji}</div>
                <div className="flex-1">
                  <p className="text-sm text-quest-dim">
                    {isSkipRequest ? "😴" : "🧒"} {quest.child.monsterName || quest.child.name} からの{isSkipRequest ? "スキップ申請" : "報告"}
                  </p>
                  <p className="text-base font-medium mt-1">{quest.template.title}</p>
                  <p className="text-xs text-quest-dim mt-1">
                    {cat.emoji} {cat.name}{!isSkipRequest && <> · +{xp}XP</>}
                  </p>
                </div>
              </div>
              {quest.comment && (
                <div className={`rounded-lg p-3 mb-4 text-sm ${
                  isSkipRequest ? "bg-red-400/5 text-red-400/70" : "bg-quest-bg text-quest-dim"
                }`}>
                  💬 {quest.comment}
                </div>
              )}
              <div className="flex gap-2">
                <div className={`flex-1 text-sm py-2 text-center rounded-xl ${
                  isSkipRequest
                    ? "bg-red-400/10 text-red-400 border border-red-400/30"
                    : "btn-gold"
                }`}>
                  {isSkipRequest ? "✓ スキップを承認" : `✓ 承認 (+${xp}XP)`}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleAction(quest.id, "reject"); }}
                  className="text-quest-dim text-sm border border-quest-border rounded-xl px-4 py-2 hover:border-red-400/30 hover:text-red-400"
                >
                  差し戻し
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
