"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { getMonsterStage, getXpInfo } from "@/lib/constants";
import type { Side } from "@/types";
import LoadingSpinner from "@/components/LoadingSpinner";

const EGG_BONUS_IMAGE: Record<string, string> = {
  STUDY: "/monsters/egg-study.webp",
  STAMINA: "/monsters/egg-stamina.webp",
  LIFE: "/monsters/egg-life.webp",
};

type Member = {
  id: string;
  name: string;
  role: string;
  side: string | null;
  monsterName: string | null;
  evolutionStage: number;
  evolutionPath: string;
  rebirthEggBonus: string | null;
  childCode: string | null;
  minTasksForStreak: number;
  reportDeadlineTime: string | null;
  studyPt: number;
  staminaPt: number;
  lifePt: number;
  collectedPaths: string;
};

type FamilyData = {
  code: string;
  members: Member[];
};

export default function FamilyPage() {
  const [family, setFamily] = useState<FamilyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", side: "LIGHT" as Side });
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");
  const [savingStreakId, setSavingStreakId] = useState<string | null>(null);
  const [deadlineTimes, setDeadlineTimes] = useState<Record<string, string>>({});
  const [savingDeadlineId, setSavingDeadlineId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  function fetchFamily() {
    fetch("/api/family/code")
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) {
          console.error("Family API error:", data);
          return null;
        }
        return data;
      })
      .then((data) => {
        if (data) {
          setFamily(data);
          const times: Record<string, string> = {};
          for (const m of data.members ?? []) {
            if (m.role === "CHILD") times[m.id] = m.reportDeadlineTime ?? "";
          }
          setDeadlineTimes(times);
        }
      })
      .catch((e) => console.error("Failed to fetch family:", e))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchFamily();
  }, []);

  async function handleCopy() {
    if (!family) return;
    await navigator.clipboard.writeText(family.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleUpdateMinTasks(childId: string, value: number) {
    if (value < 1) return;
    setSavingStreakId(childId);
    try {
      const res = await fetch("/api/family/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ childId, minTasksForStreak: value }),
      });
      if (res.ok) {
        setFamily((prev) =>
          prev
            ? {
                ...prev,
                members: prev.members.map((m) =>
                  m.id === childId ? { ...m, minTasksForStreak: value } : m,
                ),
              }
            : prev,
        );
      }
    } finally {
      setSavingStreakId(null);
    }
  }

  async function handleDeleteChild(childId: string) {
    setDeleting(true);
    try {
      const res = await fetch(`/api/family/members/${childId}`, { method: "DELETE" });
      if (res.ok) {
        setDeleteConfirmId(null);
        fetchFamily();
      }
    } finally {
      setDeleting(false);
    }
  }

  async function handleSaveDeadline(childId: string) {
    setSavingDeadlineId(childId);
    try {
      await fetch("/api/family/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ childId, reportDeadlineTime: deadlineTimes[childId]?.trim() || null }),
      });
    } finally {
      setSavingDeadlineId(null);
    }
  }

  async function handleAddChild() {
    if (!addForm.name.trim()) {
      setAddError("名前を入力してください");
      return;
    }
    setAdding(true);
    setAddError("");
    try {
      const res = await fetch("/api/family/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monsterName: addForm.name, side: addForm.side }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAddError(data.error || "追加に失敗しました");
        return;
      }
      setShowAddForm(false);
      setAddForm({ name: "", side: "LIGHT" });
      fetchFamily();
    } catch {
      setAddError("通信エラーが発生しました");
    } finally {
      setAdding(false);
    }
  }

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div>
      <h1 className="font-serif text-quest-gold text-2xl tracking-wider mb-8">
        👨‍👩‍👧‍👦 ファミリー管理
      </h1>

      {/* Family code */}
      <div className="bg-quest-card border border-quest-border rounded-xl p-6 mb-8">
        <p className="text-quest-dim text-xs tracking-wider mb-3">ファミリーコード</p>
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            {(family?.code || "------").split("").map((char, i) => (
              <div
                key={i}
                className="w-10 h-12 bg-quest-bg border border-quest-border rounded-lg flex items-center justify-center text-quest-gold font-serif text-lg tracking-wider"
              >
                {char}
              </div>
            ))}
          </div>
          <button
            onClick={handleCopy}
            className="text-sm text-quest-dim hover:text-quest-gold border border-quest-border rounded-lg px-3 py-2 transition-colors"
          >
            {copied ? "✓ コピー済み" : "コピー"}
          </button>
        </div>
        <p className="text-quest-dim text-xs mt-3">
          子どものデバイスで「ファミリーコード」＋「ユーザーコード」を入力するとログインできます
        </p>
      </div>

      {/* Members */}
      <div className="bg-quest-card border border-quest-border rounded-xl p-6">
        <div className="flex justify-between items-center mb-4">
          <p className="text-quest-dim text-xs tracking-wider">メンバー</p>
          <button
            onClick={() => setShowAddForm(true)}
            className="text-sm text-quest-gold hover:text-quest-gold/80 border border-quest-gold/30 rounded-lg px-3 py-1 transition-colors"
          >
            + 子どもを追加
          </button>
        </div>

        {/* Add child form */}
        {showAddForm && (
          <div className="bg-quest-bg border border-quest-border rounded-lg p-4 mb-4">
            <p className="text-quest-gold text-sm font-bold mb-3">新しい冒険者を追加</p>

            <label className="block text-quest-dim text-xs mb-1 tracking-wider">なまえ</label>
            <input
              type="text"
              value={addForm.name}
              onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="例: りゅうくん"
              className="w-full bg-quest-card border border-quest-border rounded-lg px-3 py-2 text-sm text-quest-text placeholder:text-quest-dim/50 focus:outline-none focus:border-quest-gold/30 mb-3"
            />

            <label className="block text-quest-dim text-xs mb-1 tracking-wider">スタイル</label>
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setAddForm((f) => ({ ...f, side: "LIGHT" }))}
                className={`flex-1 py-2 rounded-lg text-sm border transition-colors ${
                  addForm.side === "LIGHT"
                    ? "border-pink-400 bg-pink-400/10 text-pink-300"
                    : "border-quest-border text-quest-dim hover:border-quest-gold/20"
                }`}
              >
                🌸 かわいい
              </button>
              <button
                onClick={() => setAddForm((f) => ({ ...f, side: "DARK" }))}
                className={`flex-1 py-2 rounded-lg text-sm border transition-colors ${
                  addForm.side === "DARK"
                    ? "border-purple-400 bg-purple-400/10 text-purple-300"
                    : "border-quest-border text-quest-dim hover:border-quest-gold/20"
                }`}
              >
                🌑 かっこいい
              </button>
            </div>

            {addError && <p className="text-red-400 text-xs mb-3">{addError}</p>}

            <div className="flex gap-2">
              <button onClick={handleAddChild} disabled={adding} className="btn-gold flex-1 text-sm">
                {adding ? "追加中..." : "追加"}
              </button>
              <button
                onClick={() => { setShowAddForm(false); setAddError(""); }}
                className="text-quest-dim text-sm border border-quest-border rounded-xl px-4 py-2 hover:border-quest-gold/20"
              >
                キャンセル
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {family?.members.map((member) => (
            <div
              key={member.id}
              className="bg-quest-bg rounded-lg"
            >
            <div className="flex items-center gap-3 p-3">
              <div className="w-10 h-10 rounded-full bg-quest-border flex items-center justify-center text-lg overflow-hidden">
                {member.role === "PARENT" ? "👑" : (() => { const m = getMonsterStage(member.evolutionStage, member.evolutionPath ?? "", member.side); const img = member.evolutionStage === 0 && member.rebirthEggBonus && EGG_BONUS_IMAGE[member.rebirthEggBonus] ? EGG_BONUS_IMAGE[member.rebirthEggBonus] : m.image; return <Image src={img} alt={m.name} width={40} height={40} className="w-full h-full object-contain" />; })()}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">
                  {member.monsterName || member.name || "未設定"}
                </p>
                <p className="text-[10px] text-quest-dim">
                  {member.role === "PARENT" ? "ギルドマスター" : (
                    <>
                      冒険者
                      {member.side === "LIGHT" && <span className="ml-1 text-pink-400">🌸 かわいい</span>}
                      {member.side === "DARK" && <span className="ml-1 text-purple-400">🌑 かっこいい</span>}
                    </>
                  )}
                </p>
                {member.role === "CHILD" && (() => {
                  const isReborn = (JSON.parse(member.collectedPaths) as string[]).length > 0;
                  const xpInfo = getXpInfo(member.evolutionStage, member.evolutionPath, member.studyPt, member.staminaPt, member.lifePt, isReborn, member.rebirthEggBonus);
                  const total = member.studyPt + member.staminaPt + member.lifePt;
                  const pct = xpInfo.xpToEvolve !== null ? Math.min(100, Math.round((total / xpInfo.xpToEvolve) * 100)) : 100;
                  const nextLabel = member.evolutionStage === 0 ? "孵化" : xpInfo.xpToEvolve !== null ? "進化" : "転生";
                  return (
                    <div className="mt-1">
                      <p className="text-[10px] text-quest-dim">
                        <span className="text-quest-gold font-bold">Lv.{member.evolutionStage}</span>
                        <span className="mx-1">·</span>
                        <span className="text-blue-400">📚{member.studyPt}</span>{" "}
                        <span className="text-green-400">💪{member.staminaPt}</span>{" "}
                        <span className="text-yellow-400">🏠{member.lifePt}</span>
                        {xpInfo.xpToEvolve !== null && (
                          <span className="ml-1">· あと<span className="text-quest-gold font-bold"> {Math.max(0, xpInfo.ptNeeded!)} </span>ptで{nextLabel}</span>
                        )}
                      </p>
                      <div className="mt-1 h-1.5 w-full bg-quest-border rounded-full overflow-hidden">
                        <div
                          className="h-full bg-quest-gold rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="text-[9px] text-quest-dim/60 mt-0.5 text-right">
                        {total}{xpInfo.xpToEvolve !== null ? ` / ${xpInfo.xpToEvolve} pt` : " pt"}
                      </p>
                    </div>
                  );
                })()}
              </div>
              {member.role === "CHILD" && member.childCode && (
                <div className="text-right">
                  <p className="text-[10px] text-quest-dim">ユーザーコード</p>
                  <p className="text-quest-gold font-mono text-sm tracking-widest">{member.childCode}</p>
                </div>
              )}
            </div>
            {member.role === "CHILD" && (
              <div className="flex flex-col gap-2 mt-2 px-3 pb-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div>
                      <span className="text-[10px] text-quest-dim">🔥 ストリーク最低タスク数</span>
                      <p className="text-[10px] text-quest-dim/60 mt-0.5">1日にこの数以上達成するとストリーク継続</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleUpdateMinTasks(member.id, member.minTasksForStreak - 1)}
                        disabled={member.minTasksForStreak <= 1 || savingStreakId === member.id}
                        className="w-6 h-6 rounded bg-quest-border text-quest-text text-xs flex items-center justify-center disabled:opacity-30"
                      >
                        −
                      </button>
                      <span className="text-sm text-quest-gold font-bold w-6 text-center">
                        {member.minTasksForStreak}
                      </span>
                      <button
                        onClick={() => handleUpdateMinTasks(member.id, member.minTasksForStreak + 1)}
                        disabled={savingStreakId === member.id}
                        className="w-6 h-6 rounded bg-quest-border text-quest-text text-xs flex items-center justify-center disabled:opacity-30"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  {deleteConfirmId === member.id ? (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-red-400">本当に削除？</span>
                    <button
                      onClick={() => handleDeleteChild(member.id)}
                      disabled={deleting}
                      className="text-[10px] px-2 py-1 rounded bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 disabled:opacity-50"
                    >
                      削除
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(null)}
                      className="text-[10px] px-2 py-1 rounded bg-quest-border text-quest-dim hover:text-quest-text"
                    >
                      キャンセル
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeleteConfirmId(member.id)}
                    className="text-[10px] text-quest-dim/50 hover:text-red-400 transition-colors"
                  >
                    削除
                  </button>
                )}
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-[10px] text-quest-dim/60">⏰ 報告期限（JST）— この時刻より前に報告すると +1pt ボーナス。未設定なら期限なし</p>
                  <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={deadlineTimes[member.id] ?? ""}
                    onChange={(e) => setDeadlineTimes((prev) => ({ ...prev, [member.id]: e.target.value }))}
                    className="bg-quest-card border border-quest-border rounded px-2 py-1 text-xs text-quest-text focus:outline-none focus:border-quest-gold/30"
                  />
                  <button
                    onClick={() => handleSaveDeadline(member.id)}
                    disabled={savingDeadlineId === member.id}
                    className="text-[10px] px-2 py-1 rounded bg-quest-gold/20 text-quest-gold border border-quest-gold/30 hover:bg-quest-gold/30 disabled:opacity-50"
                  >
                    {savingDeadlineId === member.id ? "保存中..." : "保存"}
                  </button>
                  {deadlineTimes[member.id] && (
                    <button
                      onClick={() => { setDeadlineTimes((prev) => ({ ...prev, [member.id]: "" })); }}
                      className="text-[10px] text-quest-dim hover:text-quest-text"
                    >
                      クリア
                    </button>
                  )}
                </div>
              </div>
            </div>
            )}
            </div>
          ))}
          {(!family?.members || family.members.length === 0) && (
            <p className="text-quest-dim text-sm">メンバーはまだいません</p>
          )}
        </div>
      </div>
    </div>
  );
}
