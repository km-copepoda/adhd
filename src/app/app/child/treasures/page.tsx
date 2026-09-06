"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import LoadingSpinner from "@/components/LoadingSpinner";
import TreasureOpenCutscene from "@/components/child/TreasureOpenCutscene";
import {
  RARITY_BADGE_CLASS,
  formatChildRarity,
  type TreasureRarity,
} from "@/lib/treasureRarity";
import { SEASON_LABEL, type CollectionRarity } from "@/lib/collectionItems";
import { formatTreasureOpenedAt } from "@/lib/treasureHistory";

type Rarity = TreasureRarity;

const COLLECTION_RARITY_STARS: Record<CollectionRarity, string> = {
  COMMON: "★",
  UNCOMMON: "★★",
  RARE: "★★★",
};

interface OpenedLog {
  id: string;
  openedAt: string;
  boosted: boolean;
  item: { id: string; title: string; rarity: Rarity } | null;
  collectionItem: {
    id: string;
    name: string;
    season: "spring" | "summer" | "fall" | "winter";
    rarity: Rarity;
    image: string;
  } | null;
  fulfilled?: boolean;
}

type TreasureTab = "boxes" | "rewards";

interface StatusResponse {
  locked: number;
  unlocked: number;
  opened: OpenedLog[];
}

interface TreasureOpenResult {
  item: { id: string; title: string; rarity: Rarity } | null;
  collectionItem: {
    id: string;
    name: string;
    rarity: Rarity;
    season: "spring" | "summer" | "fall" | "winter";
    description: string;
    image: string;
    count: number;
  } | null;
  remainingUnlocked: number;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function ChildTreasuresPage() {
  const [data, setData] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [result, setResult] = useState<TreasureOpenResult | null>(null);
  const [tab, setTab] = useState<TreasureTab>("boxes");
  const [pendingFulfillId, setPendingFulfillId] = useState<string | null>(null);
  const fulfillLock = useRef(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/treasures/status", { cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as StatusResponse;
      setData(json);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  const handleOpen = async () => {
    if (opening) return;
    if (!data || data.unlocked <= 0) return;
    setOpening(true);
    try {
      const res = await fetch("/api/treasures/open", { method: "POST" });
      if (!res.ok) return;
      const json = (await res.json()) as TreasureOpenResult;
      setResult(json);
      // BottomNav バッジを即時更新するため通知
      window.dispatchEvent(new CustomEvent("treasure-changed"));
    } finally {
      setOpening(false);
    }
  };

  // #72: ごほうび一覧タブでの「つかった / つかってない」トグル（楽観更新 + 失敗ロールバック）
  const toggleFulfilled = async (id: string, next: boolean) => {
    if (fulfillLock.current) return;
    fulfillLock.current = true;
    setPendingFulfillId(id);
    setData((d) =>
      d
        ? { ...d, opened: d.opened.map((o) => (o.id === id ? { ...o, fulfilled: next } : o)) }
        : d,
    );
    try {
      const res = await fetch(`/api/child/treasures/fulfill/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fulfilled: next }),
      });
      if (!res.ok) {
        setData((d) =>
          d
            ? { ...d, opened: d.opened.map((o) => (o.id === id ? { ...o, fulfilled: !next } : o)) }
            : d,
        );
      }
    } catch {
      setData((d) =>
        d
          ? { ...d, opened: d.opened.map((o) => (o.id === id ? { ...o, fulfilled: !next } : o)) }
          : d,
      );
    } finally {
      fulfillLock.current = false;
      setPendingFulfillId(null);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!data) {
    return (
      <div className="p-6 text-center text-quest-dim text-sm">
        宝箱データを読み込めませんでした。
      </div>
    );
  }

  const hits = data.opened.filter((o) => o.item !== null);
  const collectionWins = data.opened.length - hits.length;
  const canOpen = data.unlocked > 0 && !opening;

  return (
    <div className="p-4 pb-8">
      <h1 className="text-xl font-bold mb-4 text-center">宝箱</h1>

      <div className="bg-quest-card border border-quest-border rounded-2xl p-5 mb-6 flex flex-col items-center">
        <div className="w-40 h-40 mb-3">
          <Image
            src="/treasure/closed.png"
            alt="閉じた宝箱"
            width={160}
            height={160}
            className="w-full h-full object-contain"
          />
        </div>
        <div className="flex gap-4 text-sm mb-4">
          <div className="flex items-center gap-1">
            <span aria-hidden>🔒</span>
            <span className="font-bold tabular-nums">{data.locked}</span>
            <span className="text-quest-dim text-xs">承認まち</span>
          </div>
          <div className="flex items-center gap-1">
            <span aria-hidden>🔓</span>
            <span className="font-bold tabular-nums text-quest-gold">{data.unlocked}</span>
            <span className="text-quest-dim text-xs">あけられる</span>
          </div>
        </div>
        <button
          type="button"
          onClick={handleOpen}
          disabled={!canOpen}
          className="rounded-lg bg-quest-gold py-2.5 px-5 text-sm font-bold text-quest-bg shadow disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {opening ? "ひらいてる..." : "あける"}
        </button>
      </div>

      <div className="flex gap-2 mb-3">
        <button
          type="button"
          onClick={() => setTab("boxes")}
          className={`flex-1 rounded-lg py-2 text-xs font-bold transition-colors ${
            tab === "boxes"
              ? "bg-quest-gold text-quest-bg"
              : "bg-quest-card border border-quest-border text-quest-dim"
          }`}
        >
          📦 たからばこ
        </button>
        <button
          type="button"
          onClick={() => setTab("rewards")}
          className={`flex-1 rounded-lg py-2 text-xs font-bold transition-colors ${
            tab === "rewards"
              ? "bg-quest-gold text-quest-bg"
              : "bg-quest-card border border-quest-border text-quest-dim"
          }`}
        >
          🎁 ごほうび一覧
        </button>
      </div>

      {tab === "rewards" && (
        <>
          <h2 className="text-sm font-bold text-quest-dim mb-2">🎁 ごほうび一覧</h2>
          {hits.length === 0 ? (
            <p className="text-center text-quest-dim text-xs py-6">
              まだもらったごほうびはありません。
            </p>
          ) : (
            <ul className="space-y-2">
              {hits.map((o) => (
                <li
                  key={o.id}
                  className="bg-quest-card border border-quest-border rounded-lg p-3 flex items-center gap-3"
                >
                  <span className="text-3xl" aria-hidden>🎁</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm truncate">{o.item!.title}</div>
                    <div className="text-[11px] text-quest-dim">
                      {formatTreasureOpenedAt(o.openedAt)}
                      {o.fulfilled && <span className="ml-2 text-quest-mint">✅ つかったよ</span>}
                    </div>
                  </div>
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded ${RARITY_BADGE_CLASS[o.item!.rarity]}`}
                  >
                    {formatChildRarity(o.item!.rarity)}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleFulfilled(o.id, !o.fulfilled)}
                    disabled={pendingFulfillId === o.id}
                    className={`text-xs px-3 py-1.5 rounded font-bold transition-colors disabled:opacity-50 ${
                      o.fulfilled
                        ? "bg-quest-card border border-quest-border text-quest-dim"
                        : "bg-quest-gold text-quest-bg"
                    }`}
                  >
                    {o.fulfilled ? "とりけす" : "つかう"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {tab === "boxes" && (
      <>
      <h2 className="text-sm font-bold text-quest-dim mb-2">これまでの宝箱</h2>
      {data.opened.length === 0 ? (
        <p className="text-center text-quest-dim text-xs py-6">
          まだ宝箱を開けていません。
        </p>
      ) : (
        <>
          <div className="text-xs text-quest-dim mb-2">
            ぜんぶで <span className="font-bold text-quest-text">{data.opened.length}</span>{" "}
            個（ごほうび {hits.length}・コレクション {collectionWins}）
          </div>
          <ul className="space-y-2">
            {data.opened.map((o) => (
              <li
                key={o.id}
                className="bg-quest-card border border-quest-border rounded-lg p-3 flex items-center gap-3"
              >
                <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center" aria-hidden>
                  {o.item ? (
                    <span className="text-3xl">🎁</span>
                  ) : o.collectionItem ? (
                    <Image
                      src={o.collectionItem.image}
                      alt={o.collectionItem.name}
                      width={40}
                      height={40}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <span className="text-3xl">🏆</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm truncate">
                    {o.item ? o.item.title : o.collectionItem ? o.collectionItem.name : "コレクションアイテム"}
                  </div>
                  <div className="text-[11px] text-quest-dim">
                    {o.collectionItem && (
                      <span className="mr-2">
                        {SEASON_LABEL[o.collectionItem.season]}・{COLLECTION_RARITY_STARS[o.collectionItem.rarity]}
                      </span>
                    )}
                    {formatDate(o.openedAt)}
                    {o.boosted && <span className="ml-2 text-quest-gold">★ ボーナス</span>}
                  </div>
                </div>
                {o.item && (
                  <span className={`text-[11px] px-2 py-0.5 rounded ${RARITY_BADGE_CLASS[o.item.rarity]}`}>
                    {formatChildRarity(o.item.rarity)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
      </>
      )}

      {result && (
        <TreasureOpenCutscene
          result={result}
          onClose={() => {
            setResult(null);
            void fetchStatus();
          }}
        />
      )}
    </div>
  );
}
