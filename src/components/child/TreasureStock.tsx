"use client";

import { useCallback, useEffect, useState } from "react";
import TreasureOpenCutscene from "./TreasureOpenCutscene";

interface TreasureOpenResult {
  pityTriggered: boolean;
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

export default function TreasureStock() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [opening, setOpening] = useState(false);
  const [result, setResult] = useState<TreasureOpenResult | null>(null);

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
    if (opening) return;
    if (!status || status.unlocked <= 0) return;
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

  return (
    <>
      <div className="flex items-center gap-2 rounded-full bg-quest-bg-paper/90 px-3 py-1.5 text-sm shadow-md">
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
