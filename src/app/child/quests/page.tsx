"use client";

import { useEffect, useRef, useState } from "react";
import { DIFFICULTY_LABEL, CATEGORY_LABEL, CATEGORY_COLOR, XP_MAP, DAY_LABELS } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import type { Category, Difficulty, QuestStatus } from "@/types";

type Quest = {
  id: string;
  date: string;
  status: QuestStatus;
  comment: string | null;
  template: {
    id: string;
    title: string;
    emoji: string;
    category: Category;
    difficulty: Difficulty;
    isTemporary: boolean;
    createdBy: string;
  };
};

const EMOJIS = ["⚔️", "📖", "🏃", "🧹", "🎹", "📐", "🥗", "🛏️", "🐕", "✏️"];
type FormMode = "regular" | "temporary";

export default function QuestsPage() {
  const [quests, setQuests] = useState<Quest[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportingId, setReportingId] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [skippingId, setSkippingId] = useState<string | null>(null);
  const [skipComment, setSkipComment] = useState("");
  const prevEvolutionStageRef = useRef<number | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>("temporary");
  const [form, setForm] = useState({
    title: "",
    emoji: "⚔️",
    category: "STUDY" as Category,
    difficulty: "NORMAL" as Difficulty,
    repeatDays: [1, 2, 3, 4, 5] as number[],
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchQuests();
    // 初回の進化ステージを記録
    fetch("/api/monster").then((r) => r.json()).then((d) => {
      if (d.evolutionStage !== undefined) prevEvolutionStageRef.current = d.evolutionStage;
    }).catch(() => {});

    const supabase = createClient();
    const channel = supabase
      .channel("quest-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "QuestInstance" }, async () => {
        await refreshQuests();
        // 進化チェック: ステージが上がっていたら sessionStorage にフラグセット
        try {
          const res = await fetch("/api/monster");
          if (res.ok) {
            const d = await res.json();
            if (prevEvolutionStageRef.current !== null && d.evolutionStage > prevEvolutionStageRef.current) {
              sessionStorage.setItem("pendingEvolution", "true");
            }
            prevEvolutionStageRef.current = d.evolutionStage;
          }
        } catch {}
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  async function refreshQuests() {
    const res = await fetch("/api/quests/today");
    if (res.ok) setQuests(await res.json());
  }

  async function fetchQuests() {
    setLoading(true);
    await refreshQuests();
    setLoading(false);
  }

  async function handleReport(questId: string) {
    const res = await fetch(`/api/quests/${questId}/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comment: comment || null }),
    });
    if (res.ok) {
      setReportingId(null);
      setComment("");
      fetchQuests();
    }
  }

  async function handleSkip(questId: string) {
    if (!skipComment.trim()) return;
    setSkippingId(questId);
    const res = await fetch(`/api/quests/${questId}/skip`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comment: skipComment }),
    });
    if (res.ok) {
      setReportingId(null);
      setSkipComment("");
      fetchQuests();
    }
    setSkippingId(null);
  }

  async function handleAddTask() {
    setSubmitting(true);
    const isTemporary = formMode === "temporary";
    const body = isTemporary
      ? {
          title: form.title,
          emoji: form.emoji,
          category: form.category,
          difficulty: form.difficulty,
          isTemporary: true,
        }
      : {
          title: form.title,
          emoji: form.emoji,
          category: form.category,
          difficulty: form.difficulty,
          isTemporary: false,
          repeatDays: form.repeatDays,
        };

    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSubmitting(false);
    if (res.ok) {
      setShowAddForm(false);
      setForm({ title: "", emoji: "⚔️", category: "STUDY", difficulty: "NORMAL", repeatDays: [1, 2, 3, 4, 5] });
      fetchQuests();
    }
  }

  function toggleDay(day: number) {
    setForm((f) => ({
      ...f,
      repeatDays: f.repeatDays.includes(day)
        ? f.repeatDays.filter((d) => d !== day)
        : [...f.repeatDays, day].sort(),
    }));
  }

  const completedCount = quests.filter(
    (q) => q.status === "REPORTED" || q.status === "APPROVED"
  ).length;

  const provisionalPt = quests
    .filter((q) => q.status === "REPORTED")
    .reduce((sum, q) => sum + XP_MAP[q.template.difficulty], 0);

  const confirmedPt = quests
    .filter((q) => q.status === "APPROVED")
    .reduce((sum, q) => sum + XP_MAP[q.template.difficulty], 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-quest-dim">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="px-4 pt-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="font-serif text-quest-gold text-lg tracking-wider">
              ⚔ 今日のクエスト
            </h1>
            <p className="text-quest-dim text-xs mt-1">
              {completedCount} / {quests.length} 完了
            </p>
            {(provisionalPt > 0 || confirmedPt > 0) && (
              <div className="flex gap-3 mt-1">
                {provisionalPt > 0 && (
                  <span className="text-[10px] text-quest-dim">
                    仮 <span className="text-quest-gold/60 font-bold">{provisionalPt}</span> pt
                  </span>
                )}
                {confirmedPt > 0 && (
                  <span className="text-[10px] text-quest-dim">
                    本 <span className="text-quest-gold font-bold">{confirmedPt}</span> pt
                  </span>
                )}
              </div>
            )}
          </div>
          <button
            onClick={() => setShowAddForm((v) => !v)}
            className="text-xs border border-quest-border rounded-lg px-3 py-1.5 text-quest-dim hover:border-quest-gold/40 hover:text-quest-gold transition-colors"
          >
            + タスクを追加
          </button>
        </div>
        {/* Progress bar */}
        <div className="mt-2 h-1.5 bg-quest-border rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-quest-gold-dark to-quest-gold rounded-full transition-all"
            style={{
              width: quests.length > 0 ? `${(completedCount / quests.length) * 100}%` : "0%",
            }}
          />
        </div>
      </div>

      {/* Add task form */}
      {showAddForm && (
        <div className="bg-quest-card border border-quest-border rounded-xl p-4 mb-6">
          {/* Mode tabs */}
          <div className="flex gap-1 mb-4 bg-quest-bg rounded-lg p-1">
            <button
              onClick={() => setFormMode("temporary")}
              className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${
                formMode === "temporary"
                  ? "bg-quest-gold/20 text-quest-gold border border-quest-gold/30"
                  : "text-quest-dim"
              }`}
            >
              ⚡ 一時タスク
            </button>
            <button
              onClick={() => setFormMode("regular")}
              className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${
                formMode === "regular"
                  ? "bg-quest-gold/20 text-quest-gold border border-quest-gold/30"
                  : "text-quest-dim"
              }`}
            >
              📅 通常タスク
            </button>
          </div>

          <p className="text-quest-dim text-[10px] mb-3">
            {formMode === "temporary"
              ? "今日だけ表示されるタスクを追加します"
              : "毎週繰り返す自分のタスクを追加します"}
          </p>

          {/* Title */}
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="タスク名を入力..."
            className="w-full bg-quest-bg border border-quest-border rounded-lg px-3 py-2 text-sm text-quest-text placeholder:text-quest-dim/50 focus:outline-none focus:border-quest-gold/30 mb-3"
          />

          {/* Emoji */}
          <div className="flex gap-1 mb-3 flex-wrap">
            {EMOJIS.map((e) => (
              <button
                key={e}
                onClick={() => setForm((f) => ({ ...f, emoji: e }))}
                className={`w-8 h-8 rounded-lg text-base flex items-center justify-center border transition-colors ${
                  form.emoji === e
                    ? "border-quest-gold bg-quest-gold/10"
                    : "border-quest-border"
                }`}
              >
                {e}
              </button>
            ))}
          </div>

          {/* Category */}
          <div className="flex gap-1.5 mb-3">
            {(["STUDY", "STAMINA", "LIFE"] as Category[]).map((cat) => {
              const label = CATEGORY_LABEL[cat];
              return (
                <button
                  key={cat}
                  onClick={() => setForm((f) => ({ ...f, category: cat }))}
                  className={`flex-1 py-1.5 rounded-lg text-xs border transition-colors ${
                    form.category === cat
                      ? "border-quest-gold bg-quest-gold/10 text-quest-gold"
                      : "border-quest-border text-quest-dim"
                  }`}
                >
                  {label.emoji} {label.name}
                </button>
              );
            })}
          </div>

          {/* Difficulty */}
          <div className="flex gap-1.5 mb-3">
            {(["EASY", "NORMAL", "HARD"] as Difficulty[]).map((diff) => {
              const label = DIFFICULTY_LABEL[diff];
              return (
                <button
                  key={diff}
                  onClick={() => setForm((f) => ({ ...f, difficulty: diff }))}
                  className="flex-1 py-1.5 rounded-lg text-xs border transition-colors"
                  style={
                    form.difficulty === diff
                      ? { borderColor: label.color, backgroundColor: `${label.color}20`, color: label.color }
                      : { borderColor: "var(--quest-border)", color: "var(--quest-dim)" }
                  }
                >
                  {label.name}
                </button>
              );
            })}
          </div>

          {/* Repeat days (regular only) */}
          {formMode === "regular" && (
            <div className="flex gap-1 mb-3">
              {DAY_LABELS.map((label, i) => (
                <button
                  key={i}
                  onClick={() => toggleDay(i)}
                  className={`w-8 h-8 rounded-lg text-xs font-bold border transition-colors ${
                    form.repeatDays.includes(i)
                      ? "border-quest-gold bg-quest-gold/10 text-quest-gold"
                      : "border-quest-border text-quest-dim"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleAddTask}
              disabled={!form.title.trim() || submitting}
              className="btn-gold flex-1 text-xs py-2 disabled:opacity-40"
            >
              {submitting ? "追加中..." : "追加する"}
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="text-quest-dim text-xs border border-quest-border rounded-xl px-3 py-2"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      {/* Quest list */}
      <div className="flex flex-col gap-3">
        {quests.length === 0 && (
          <p className="text-quest-dim text-sm text-center py-12">
            今日のクエストはまだないよ。
            <br />
            上の「タスクを追加」か、ギルドマスター（親）に作ってもらおう！
          </p>
        )}
        {quests.map((quest) => {
          const cat = CATEGORY_LABEL[quest.template.category];
          const diff = DIFFICULTY_LABEL[quest.template.difficulty];
          const xp = XP_MAP[quest.template.difficulty];
          const isTemporary = quest.template.isTemporary;
          const isApproved = quest.status === "APPROVED";
          const isReported = quest.status === "REPORTED";
          const isSkipped = quest.status === "SKIPPED";
          const isSkipReported = quest.status === "SKIP_REPORTED";
          const isDone = isApproved || isReported || isSkipped || isSkipReported;

          return (
            <div key={quest.id}>
              <div
                onClick={() => !isDone && setReportingId(reportingId === quest.id ? null : quest.id)}
                className={`relative bg-quest-card border border-quest-border rounded-xl overflow-hidden transition-all ${
                  isDone ? "opacity-50" : "cursor-pointer hover:border-quest-gold/30"
                }`}
              >
                {/* Difficulty stripe */}
                <div
                  className="absolute left-0 top-0 bottom-0 w-1"
                  style={{ backgroundColor: diff.color }}
                />

                <div className="flex items-center gap-3 p-4 pl-5">
                  {/* Icon */}
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-xl shrink-0"
                    style={{
                      backgroundColor: `${CATEGORY_COLOR[quest.template.category]}15`,
                    }}
                  >
                    {quest.template.emoji}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium truncate">{quest.template.title}</p>
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
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded"
                        style={{
                          backgroundColor: `${diff.color}20`,
                          color: diff.color,
                        }}
                      >
                        {diff.name}
                      </span>
                      <span className="text-[10px] text-quest-dim">
                        {cat.emoji} {cat.name}
                      </span>
                    </div>
                  </div>

                  {/* XP + Action */}
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-xs font-bold ${isSkipped || isSkipReported ? "text-quest-dim line-through" : isApproved ? "text-quest-gold" : isReported ? "text-quest-gold/40" : "text-quest-gold"}`}>+{xp}XP</span>
                    {isApproved ? (
                      <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 text-sm" title="承認済み">
                        ✓
                      </div>
                    ) : isReported ? (
                      <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center text-green-400/40 text-sm" title="確認待ち">
                        ✓
                      </div>
                    ) : isSkipReported ? (
                      <div className="w-8 h-8 rounded-full bg-red-400/10 flex items-center justify-center text-red-400/50 text-sm" title="スキップ申請中">
                        −
                      </div>
                    ) : isSkipped ? (
                      <div className="w-8 h-8 rounded-full bg-quest-border/30 flex items-center justify-center text-quest-dim text-sm" title="スキップ承認済み">
                        −
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-full border-2 border-quest-border/60" />
                    )}
                  </div>
                </div>
              </div>

              {/* Report form */}
              {reportingId === quest.id && (
                <div className="bg-quest-card/50 border border-quest-border border-t-0 rounded-b-xl p-4">
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="コメント（なくてもOK）"
                    className="w-full bg-quest-bg border border-quest-border rounded-lg px-3 py-2 text-sm text-quest-text placeholder:text-quest-dim/50 focus:outline-none focus:border-quest-gold/30 resize-none h-16 mb-3"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleReport(quest.id)}
                      className="btn-gold flex-1 text-sm py-2.5"
                    >
                      ⚔ クエスト完了を報告する
                    </button>
                  </div>
                  <div className="mt-3 pt-3 border-t border-quest-border/50">
                    <p className="text-[10px] text-quest-dim mb-1.5">😴 今日はできない場合</p>
                    <input
                      type="text"
                      value={skipComment}
                      onChange={(e) => setSkipComment(e.target.value)}
                      placeholder="理由を入力（必須）"
                      className="w-full bg-quest-bg border border-quest-border rounded-lg px-3 py-2 text-xs text-quest-text placeholder:text-quest-dim/50 focus:outline-none focus:border-red-400/30 mb-2"
                    />
                    <button
                      onClick={() => handleSkip(quest.id)}
                      disabled={skippingId === quest.id || !skipComment.trim()}
                      className="w-full text-xs border border-quest-border rounded-xl px-3 py-2 text-quest-dim hover:border-red-400/30 hover:text-red-400/70 transition-colors disabled:opacity-40"
                    >
                      😴 スキップする
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
