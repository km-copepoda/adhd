"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  buildStampMessage,
  getStampProgressStatus,
  getStampStatusText,
  type StampProgressStatus,
} from "@/lib/gathering";
import EncouragementCutscene from "./EncouragementCutscene";

type Member = {
  id: string;
  monsterName: string;
  isMe: boolean;
};

type Props = {
  groupId: string;
  members: Member[];
};

type ReceivedStamp = { id: string; senderName: string; status: StampProgressStatus };

type StampRow = { id: string; groupId: string; senderId: string; date: string };

const SEEN_KEY = "gathering:seenStampIds";
const SEEN_MAX = 100;
const MAX_NAMES_SHOWN = 3;

function readSeenIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(SEEN_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    return new Set(Array.isArray(arr) ? (arr as string[]) : []);
  } catch {
    return new Set();
  }
}

function addSeenIds(ids: string[]) {
  if (typeof window === "undefined" || ids.length === 0) return;
  const set = readSeenIds();
  for (const id of ids) set.add(id);
  const trimmed = Array.from(set).slice(-SEEN_MAX);
  window.localStorage.setItem(SEEN_KEY, JSON.stringify(trimmed));
}

async function fetchOwnProgressStatus(): Promise<StampProgressStatus> {
  try {
    const res = await fetch("/api/quests/today");
    if (!res.ok) return "NOT_STARTED";
    const quests: Array<{ status: string }> = await res.json();
    const total = quests.length;
    const done = quests.filter((q) =>
      ["REPORTED", "SKIP_REPORTED", "APPROVED", "SKIPPED"].includes(q.status),
    ).length;
    return getStampProgressStatus(done, total);
  } catch {
    return "NOT_STARTED";
  }
}

/** 受信済みスタンプ一覧から演出に表示する subtitle / description を組み立てる。 */
function buildCutsceneText(stamps: ReceivedStamp[]): { subtitle?: string; description: string } {
  const latestStatus = stamps[stamps.length - 1].status;
  if (stamps.length === 1) {
    return { description: buildStampMessage(stamps[0].senderName, latestStatus) };
  }
  const uniqueNames = Array.from(new Set(stamps.map((s) => s.senderName)));
  const shown = uniqueNames.slice(0, MAX_NAMES_SHOWN);
  const restCount = uniqueNames.length - shown.length;
  const namesText =
    restCount > 0 ? `${shown.join("・")}・ほか${restCount}人` : shown.join("・");
  return { subtitle: `${namesText}からエール！`, description: getStampStatusText(latestStatus) };
}

export default function GatheringStampPanel({ groupId, members }: Props) {
  const [sentToday, setSentToday] = useState<boolean | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receivedStamps, setReceivedStamps] = useState<ReceivedStamp[]>([]);
  const claimedIdsRef = useRef<Set<string>>(new Set());

  const me = members.find((m) => m.isMe);

  // 同一 ID の二重処理（マウント再生 / Realtime の競合含む）を防ぐための予約。
  // 同期的に判定・記録することで await をまたいだ競合を防ぐ。
  const claimStamp = useCallback((id: string): boolean => {
    if (readSeenIds().has(id) || claimedIdsRef.current.has(id)) return false;
    claimedIdsRef.current.add(id);
    addSeenIds([id]);
    return true;
  }, []);

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

  // マウント時: 当日届いた未読エールを全画面演出で再生する。
  // Push を抑制した DONE 状態の受信者でも、ひろばを開いたタイミングでここで気づける。
  useEffect(() => {
    if (!me) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/gathering/stamps/received-today");
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          stamps: Array<{ id: string; senderId: string; senderName: string }>;
        };
        if (cancelled || data.stamps.length === 0) return;

        const claimed = data.stamps.filter((s) => claimStamp(s.id));
        if (claimed.length === 0) return;

        const status = await fetchOwnProgressStatus();
        if (cancelled) return;
        setReceivedStamps((prev) => [
          ...prev,
          ...claimed.map((s) => ({ id: s.id, senderName: s.senderName, status })),
        ]);
      } catch {
        // 失敗時は黙って終了（次回マウントで再試行）
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [me, claimStamp]);

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
          if (!claimStamp(row.id)) return; // マウント再生・他イベントで既に処理済み

          const sender = members.find((m) => m.id === row.senderId);
          const senderName = sender?.monsterName ?? "なかま";
          const status = await fetchOwnProgressStatus();
          setReceivedStamps((prev) => [...prev, { id: row.id, senderName, status }]);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId, me, members, claimStamp]);

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

      {receivedStamps.length > 0 &&
        (() => {
          const { subtitle, description } = buildCutsceneText(receivedStamps);
          return (
            <EncouragementCutscene
              subtitle={subtitle}
              description={description}
              onClose={() => setReceivedStamps([])}
            />
          );
        })()}
    </>
  );
}
