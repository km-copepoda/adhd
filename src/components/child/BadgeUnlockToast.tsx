"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ALL_BADGES, type Badge } from "@/lib/badges.data";

const SHOWN_KEY = "shownBadgeToastIds";
const AUTO_DISMISS_MS = 5000;

/**
 * バッジ解除時にスライドインで「どのバッジを解除したか」を通知するトースト。
 * 複数バッジが同時に解除された場合はキューに積んで順番に表示する。
 */
export default function BadgeUnlockToast() {
  const [current, setCurrent] = useState<Badge | null>(null);
  const [visible, setVisible] = useState(false);
  const queueRef = useRef<Badge[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showingRef = useRef(false);

  function showNext() {
    if (showingRef.current || queueRef.current.length === 0) return;
    const next = queueRef.current.shift()!;
    showingRef.current = true;
    setCurrent(next);
    setVisible(true);

    timerRef.current = setTimeout(() => {
      dismiss();
    }, AUTO_DISMISS_MS);
  }

  function dismiss() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setVisible(false);
    // アニメーションが終わったあとに次を表示
    setTimeout(() => {
      showingRef.current = false;
      setCurrent(null);
      showNext();
    }, 400);
  }

  function enqueue(badge: Badge) {
    // 既に表示済みのトーストは再表示しない（ページをまたいでも）
    try {
      const shown: string[] = JSON.parse(localStorage.getItem(SHOWN_KEY) ?? "[]");
      if (shown.includes(badge.id)) return;
      shown.push(badge.id);
      // 最大200件まで保持（古いものから削除）
      if (shown.length > 200) shown.splice(0, shown.length - 200);
      localStorage.setItem(SHOWN_KEY, JSON.stringify(shown));
    } catch { /* ignore */ }

    queueRef.current.push(badge);
    showNext();
  }

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("badge-toast-listener")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "UserBadge" },
        (payload) => {
          const badgeId = (payload.new as { badgeId?: string }).badgeId;
          if (!badgeId) return;
          const badge = ALL_BADGES.find(b => b.id === badgeId);
          if (badge) enqueue(badge);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!current) return null;

  return (
    <div
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-[200] w-[calc(100%-2rem)] max-w-sm
        transition-all duration-400 ease-out
        ${visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4 pointer-events-none"}`}
      role="alert"
      aria-live="polite"
    >
      <Link
        href="/app/child/badges"
        onClick={dismiss}
        className="flex items-center gap-3 bg-quest-card border border-quest-gold rounded-2xl px-4 py-3 shadow-xl shadow-quest-gold/20 active:scale-95 transition-transform"
      >
        {/* バッジ絵文字 */}
        <span className="text-3xl flex-shrink-0 drop-shadow">{current.emoji}</span>

        {/* テキスト */}
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-quest-gold font-bold tracking-wider mb-0.5">
            🏅 実績を解除！
          </p>
          <p className="text-sm font-bold text-quest-text leading-tight truncate">
            {current.name}
          </p>
          <p className="text-[10px] text-quest-dim leading-tight line-clamp-1 mt-0.5">
            {current.description}
          </p>
        </div>

        {/* 閉じるボタン */}
        <button
          onClick={(e) => { e.preventDefault(); dismiss(); }}
          className="flex-shrink-0 text-quest-dim hover:text-quest-text p-1 -mr-1"
          aria-label="閉じる"
        >
          ✕
        </button>
      </Link>
    </div>
  );
}
