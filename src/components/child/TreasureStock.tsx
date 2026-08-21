"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import TreasureOpenCutscene from "./TreasureOpenCutscene";

interface TreasureOpenResult {
  item: { id: string; title: string; rarity: "COMMON" | "UNCOMMON" | "RARE" } | null;
  collectionItem: {
    id: string;
    name: string;
    rarity: "COMMON" | "UNCOMMON" | "RARE";
    season: "spring" | "summer" | "fall" | "winter";
    description: string;
    image: string;
    count: number;
  } | null;
  remainingUnlocked: number;
}

interface StatusResponse {
  locked: number;
  unlocked: number;
}

interface Props {
  /** "pill"（既定）: 従来の丸ピル表示。"card": QuestStatusCard 内スロット用の見た目。 */
  variant?: "pill" | "card";
}

export default function TreasureStock({ variant = "pill" }: Props = {}) {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [opening, setOpening] = useState(false);
  const [result, setResult] = useState<TreasureOpenResult | null>(null);
  // setOpening は非同期に反映されるため、連打時の二重POSTを防ぐには同期的なrefガードが必要
  const openingRef = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/treasures/status", { cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as StatusResponse;
      setStatus(json);
    } catch {
      // 失敗時は黙ってスキップ（次回 refresh で復旧）
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleOpen = async () => {
    if (openingRef.current) return;
    if (!status || status.unlocked <= 0) return;
    openingRef.current = true;
    setOpening(true);
    try {
      const res = await fetch("/api/treasures/open", { method: "POST" });
      if (!res.ok) return;
      const json = (await res.json()) as TreasureOpenResult;
      setResult(json);
      setStatus((s) => (s ? { ...s, unlocked: json.remainingUnlocked } : s));
      // BottomNav バッジを即時更新するため通知
      window.dispatchEvent(new CustomEvent("treasure-changed"));
    } finally {
      openingRef.current = false;
      setOpening(false);
    }
  };

  if (!status) return null;
  if (status.locked === 0 && status.unlocked === 0) {
    return (
      <>
        {result && (
          <TreasureOpenCutscene
            result={result}
            onClose={() => {
              setResult(null);
              void refresh();
            }}
          />
        )}
      </>
    );
  }

  const wrapperClassName =
    variant === "card"
      ? "flex items-center gap-2 rounded-lg bg-quest-card border border-quest-border px-3 py-1.5 text-sm"
      : "flex items-center gap-2 rounded-full bg-quest-card px-3 py-1.5 text-sm shadow-md";

  return (
    <>
      <div className={wrapperClassName}>
        <span className="flex items-center gap-1">
          <span aria-hidden>🔒</span>
          <span className="font-bold tabular-nums">{status.locked}</span>
        </span>
        <span className="flex items-center gap-1">
          <span aria-hidden>🔓</span>
          <span className="font-bold tabular-nums text-quest-gold">{status.unlocked}</span>
        </span>
        <button
          type="button"
          onClick={handleOpen}
          disabled={status.unlocked <= 0 || opening}
          className="ml-1 rounded-lg bg-quest-gold px-3 py-1 text-xs font-bold text-quest-bg shadow disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {opening ? "..." : "あける"}
        </button>
      </div>
      {result && (
        <TreasureOpenCutscene
          result={result}
          onClose={() => {
            setResult(null);
            void refresh();
          }}
        />
      )}
    </>
  );
}
