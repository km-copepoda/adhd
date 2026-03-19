"use client";

import { useEffect, useState } from "react";
import { CATEGORY_LABEL, XP_MAP } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import type { Category, Difficulty, QuestStatus } from "@/types";
import LoadingSpinner from "@/components/LoadingSpinner";

type PendingQuest = {
  id: string;
  templateId: string;
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
    isTemporary: boolean;
  };
};

const getTomorrowStr = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
};

export default function ApprovePage() {
  const [quests, setQuests] = useState<PendingQuest[]>([]);
  const [loading, setLoading] = useState(true);
  const [copyEnabled, setCopyEnabled] = useState<Record<string, boolean>>({});
  const [copyDates, setCopyDates] = useState<Record<string, string>>({});

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

  async function handleAction(quest: PendingQuest, action: "approve" | "reject") {
    await fetch(`/api/approve/${quest.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });

    // スキップ承認 + 一時タスク + コピーオン の場合、翌日にコピー
    if (
      action === "approve" &&
      quest.status === "SKIP_REPORTED" &&
      quest.template.isTemporary &&
      copyEnabled[quest.id]
    ) {
      const targetDate = copyDates[quest.id] ?? getTomorrowStr();
      await fetch(`/api/tasks/${quest.templateId}/copy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetDate }),
      });
    }

    fetchPending();
  }

  async function handleBulkApprove() {
    await Promise.all(quests.map((q) => handleAction(q, "approve")));
    fetchPending();
  }

  if (loading) {
    return <LoadingSpinner />;
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
          const showCopyOption = isSkipRequest && quest.template.isTemporary;
          return (
            <div
              key={quest.id}
              onClick={() => handleAction(quest, "approve")}
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
              {showCopyOption && (
                <div
                  className="flex items-center gap-2 mb-4 p-3 bg-orange-500/5 border border-orange-500/20 rounded-lg"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    id={`copy-${quest.id}`}
                    checked={copyEnabled[quest.id] ?? false}
                    onChange={(e) =>
                      setCopyEnabled((prev) => ({ ...prev, [quest.id]: e.target.checked }))
                    }
                    className="accent-orange-400"
                  />
                  <label htmlFor={`copy-${quest.id}`} className="text-xs text-orange-300 cursor-pointer">
                    📅 次の日に送る
                  </label>
                  {copyEnabled[quest.id] && (
                    <input
                      type="date"
                      className="ml-auto text-xs bg-quest-bg border border-quest-border rounded-lg px-2 py-1 text-quest-text"
                      value={copyDates[quest.id] ?? getTomorrowStr()}
                      min={getTomorrowStr()}
                      onChange={(e) =>
                        setCopyDates((prev) => ({ ...prev, [quest.id]: e.target.value }))
                      }
                    />
                  )}
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
                  onClick={(e) => { e.stopPropagation(); handleAction(quest, "reject"); }}
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
