"use client";

import { useCallback, useEffect, useState } from "react";
import LoadingSpinner from "@/components/LoadingSpinner";
import ParentTreasureTabs from "@/components/parent/ParentTreasureTabs";
import { formatTreasureOpenedAt } from "@/lib/treasureHistory";
import {
  RARITY_LABEL,
  RARITY_BADGE_CLASS,
  type TreasureRarity,
} from "@/lib/treasureRarity";

interface HistoryItem {
  id: string;
  openedAt: string;
  item: { id: string; title: string; rarity: TreasureRarity } | null;
  child: { id: string; name: string | null; monsterName: string | null };
  fulfilled: boolean;
}

export default function ParentTreasureHistoryPage() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/treasures/pending", { cache: "no-store" });
      if (!res.ok) return;
      const json = await res.json();
      setItems(json.items ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchItems();
  }, [fetchItems]);

  // 渡したよチェックをトグルする。子画面には露出しない (親メモ専用)。
  // MVP の水掛け論対策 — 2026-05-31 復活 (decisions.md)
  async function toggleFulfilled(id: string, next: boolean) {
    setPendingId(id);
    // optimistic update
    setItems((arr) => arr.map((i) => (i.id === id ? { ...i, fulfilled: next } : i)));
    try {
      const res = await fetch(`/api/treasures/fulfill/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fulfilled: next }),
      });
      if (!res.ok) {
        // 失敗したら元に戻す
        setItems((arr) => arr.map((i) => (i.id === id ? { ...i, fulfilled: !next } : i)));
      }
    } catch {
      setItems((arr) => arr.map((i) => (i.id === id ? { ...i, fulfilled: !next } : i)));
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <ParentTreasureTabs active="history" />

      <h1 className="text-2xl font-bold mb-1">🎁 もらったごほうび</h1>
      <p className="text-sm text-quest-dim mb-4">
        子供が宝箱から引き当てたごほうびの履歴です。実際に渡したら「渡した」をチェックしておくと、後で「もらってない」と言われたとき確認できます（このチェックは子供には見えません）。
      </p>

      {loading ? (
        <LoadingSpinner />
      ) : items.length === 0 ? (
        <div className="bg-quest-card border border-quest-border rounded-xl p-6 text-center">
          <p className="text-sm text-quest-dim">まだもらったごほうびはありません。</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((it) => (
            <li
              key={it.id}
              className="bg-quest-card border border-quest-border rounded-lg p-3 flex items-center gap-3"
            >
              <div className="flex-1">
                <div className="text-xs text-quest-dim flex items-center gap-2">
                  <span>{it.child.monsterName ?? it.child.name ?? "子供"}</span>
                  {it.openedAt && <span>{formatTreasureOpenedAt(it.openedAt)}</span>}
                  <span className={it.fulfilled ? "text-quest-mint" : "text-amber-400"}>
                    {it.fulfilled ? "✅ 渡し済み" : "⏳ まだ渡してない"}
                  </span>
                </div>
                <div className="font-bold">{it.item?.title ?? "—"}</div>
              </div>
              {it.item && (
                <span className={`text-xs px-2 py-1 rounded ${RARITY_BADGE_CLASS[it.item.rarity]}`}>
                  {RARITY_LABEL[it.item.rarity]}
                </span>
              )}
              <button
                type="button"
                onClick={() => toggleFulfilled(it.id, !it.fulfilled)}
                disabled={pendingId === it.id}
                className={`text-xs px-3 py-1.5 rounded font-bold transition-colors disabled:opacity-50 ${
                  it.fulfilled
                    ? "bg-quest-card border border-quest-border text-quest-dim hover:text-quest-text"
                    : "bg-quest-gold text-quest-bg hover:opacity-90"
                }`}
              >
                {it.fulfilled ? "取り消し" : "渡した"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
