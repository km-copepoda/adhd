"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { buildStampMessage, getStampProgressStatus } from "@/lib/gathering";

type Member = {
  id: string;
  monsterName: string;
  isMe: boolean;
};

type Props = {
  groupId: string;
  members: Member[];
};

type ToastEntry = { id: string; message: string };

type StampRow = { id: string; groupId: string; senderId: string; date: string };

const TOAST_DURATION_MS = 5000;

export default function GatheringStampPanel({ groupId, members }: Props) {
  const [sentToday, setSentToday] = useState<boolean | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastEntry[]>([]);

  const me = members.find((m) => m.isMe);

  // 初回: 今日送信済みかチェック
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/gathering/stamp/today");
        if (res.ok) {
          const data = await res.json();
          setSentToday(data.sentToday);
        }
      } catch {
        setSentToday(false);
      }
    })();
  }, []);

  const showToast = useCallback((message: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, TOAST_DURATION_MS);
  }, []);

  // Realtime: 同じグループの Stamp INSERT を購読
  useEffect(() => {
    if (!me) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`stamp-${groupId}-${me.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "Stamp", filter: `groupId=eq.${groupId}` },
        async (payload) => {
          const row = payload.new as StampRow;
          if (row.senderId === me.id) return; // 自分が送ったものはスキップ

          const sender = members.find((m) => m.id === row.senderId);
          const senderName = sender?.monsterName ?? "なかま";

          // 自分の当日進捗を取得 → 状態判定 → メッセージ生成
          try {
            const res = await fetch("/api/quests/today");
            if (!res.ok) {
              showToast(buildStampMessage(senderName, "NOT_STARTED"));
              return;
            }
            const quests: Array<{ status: string }> = await res.json();
            const total = quests.length;
            const done = quests.filter((q) =>
              ["REPORTED", "SKIP_REPORTED", "APPROVED", "SKIPPED"].includes(q.status),
            ).length;
            const status = getStampProgressStatus(done, total);
            showToast(buildStampMessage(senderName, status));
          } catch {
            showToast(buildStampMessage(senderName, "NOT_STARTED"));
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId, me, members, showToast]);

  async function handleSend() {
    setError(null);
    setSending(true);
    try {
      const res = await fetch("/api/gathering/stamp", { method: "POST" });
      if (res.ok) {
        setSentToday(true);
      } else {
        const data = await res.json().catch(() => ({}));
        if (res.status === 409) {
          setSentToday(true);
          setError(data.error ?? "今日はもう送ったよ");
        } else {
          setError(data.error ?? "送信できませんでした");
        }
      }
    } finally {
      setSending(false);
    }
  }

  const disabled = sending || sentToday === true || sentToday === null;

  return (
    <>
      <div className="bg-quest-card border border-quest-border rounded-xl p-4 mb-4">
        <button
          onClick={handleSend}
          disabled={disabled}
          className="w-full py-3 bg-quest-gold text-quest-bg font-bold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
        >
          {sentToday ? "今日のエールは送信ずみ" : sending ? "送信中…" : "📣 みんなにエールを送る"}
        </button>
        <p className="text-[11px] text-quest-dim/70 mt-2 text-center">
          1日1回まで。なかまに届いたメッセージは進捗で変わるよ
        </p>
        {error && <p className="text-red-400 text-xs mt-2 text-center">{error}</p>}
      </div>

      {/* 受信トースト（複数同時表示も縦に積む） */}
      {toasts.length > 0 && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 max-w-sm w-[90%] pointer-events-none">
          {toasts.map((t) => (
            <div
              key={t.id}
              className="bg-quest-gold text-quest-bg rounded-xl px-4 py-3 shadow-lg text-sm font-bold animate-fade-in"
            >
              📣 {t.message}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
