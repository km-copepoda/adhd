"use client";

// 親代理（子供モード）— 子供の宝箱ストックと開封履歴を閲覧 / 操作する。
// 子供セルフ画面 (/app/child/treasures) と同等の UI で、API だけ child-view 経路に差し替える。
// 親代理で開封しても親自身への Push 通知は走らない（routes 側で除外）。
// `treasure-changed` カスタムイベントも発火しない — 子供 BottomNav のバッジは
// 子供端末でのみ管理する（親の localStorage を汚さない）。

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import LoadingSpinner from "@/components/LoadingSpinner";
import TreasureOpenCutscene from "@/components/child/TreasureOpenCutscene";
import {
  RARITY_BADGE_CLASS,
  formatChildRarity,
  type TreasureRarity,
} from "@/lib/treasureRarity";

type Rarity = TreasureRarity;

interface OpenedLog {
  id: string;
  openedAt: string;
  boosted: boolean;
  item: { id: string; title: string; rarity: Rarity } | null;
}

interface StatusResponse {
  locked: number;
  unlocked: number;
  hasPool: boolean;
  opened: OpenedLog[];
}

interface TreasureOpenResult {
  miss: boolean;
  pityTriggered: boolean;
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

export default function ParentChildViewTreasuresPage() {
  const params = useParams<{ childId: string }>();
  const childId = params?.childId;
  const [data, setData] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [result, setResult] = useState<TreasureOpenResult | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!childId) return;
    try {
      const res = await fetch(
        `/api/parent/child-view/treasures/status?childId=${encodeURIComponent(childId)}`,
        { cache: "no-store" },
      );
      if (!res.ok) return;
      const json = (await res.json()) as StatusResponse;
      setData(json);
    } finally {
      setLoading(false);
    }
  }, [childId]);

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  const handleOpen = async () => {
    if (opening) return;
    if (!data || data.unlocked <= 0) return;
    if (!childId) return;
    setOpening(true);
    try {
      const res = await fetch(`/api/parent/child-view/treasures/open`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ childId }),
      });
      if (!res.ok) return;
      const json = (await res.json()) as TreasureOpenResult;
      setResult(json);
    } finally {
      setOpening(false);
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
      <h1 className="text-xl font-bold mb-1 text-center">宝箱（代理閲覧）</h1>
      <p className="text-quest-dim text-xs text-center mb-4">
        親モードでも開封できます。子供端末を持たない家庭向け。
      </p>

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
                <div className="w-10 h-10 flex-shrink-0">
                  <Image
                    src={o.item ? "/treasure/open2.png" : "/treasure/open1.png"}
                    alt={o.item ? "ごほうび" : "コレクション"}
                    width={40}
                    height={40}
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm truncate">
                    {o.item ? o.item.title : "🎁 コレクションアイテム"}
                  </div>
                  <div className="text-[11px] text-quest-dim">
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
