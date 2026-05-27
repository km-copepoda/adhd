"use client";

import { useCallback, useEffect, useState } from "react";
import LoadingSpinner from "@/components/LoadingSpinner";

type Rarity = "COMMON" | "UNCOMMON" | "RARE";

const RARITY_LABEL: Record<Rarity, string> = {
  COMMON: "よく出る",
  UNCOMMON: "ときどき",
  RARE: "たまに",
};

const RARITY_COLOR: Record<Rarity, string> = {
  COMMON: "bg-blue-100 text-blue-700",
  UNCOMMON: "bg-purple-100 text-purple-700",
  RARE: "bg-amber-100 text-amber-700",
};

interface PendingItem {
  id: string;
  openedAt: string;
  item: { id: string; title: string; rarity: Rarity } | null;
  child: { id: string; name: string | null; monsterName: string | null };
}

export default function PendingTreasuresPage() {
  const [items, setItems] = useState<PendingItem[]>([]);
  const [loading, setLoading] = useState(true);

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

  const handleFulfill = async (id: string) => {
    const res = await fetch(`/api/treasures/fulfill/${id}`, { method: "POST" });
    if (res.ok) void fetchItems();
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">🎁 渡すごほうび</h1>
      <p className="text-sm text-quest-dim mb-4">
        子供が宝箱から引き当てたごほうびの一覧です。実際に渡したら「渡したよ」を押してください。
      </p>

      {items.length === 0 ? (
        <div className="bg-quest-card border border-quest-border rounded-xl p-6 text-center">
          <p className="text-sm text-quest-dim">渡すべきごほうびはありません。</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((it) => (
            <li
              key={it.id}
              className="bg-quest-card border border-quest-border rounded-lg p-3 flex items-center gap-3"
            >
              <div className="flex-1">
                <div className="text-xs text-quest-dim">
                  {it.child.monsterName ?? it.child.name ?? "子供"}
                </div>
                <div className="font-bold">{it.item?.title ?? "—"}</div>
              </div>
              {it.item && (
                <span className={`text-xs px-2 py-1 rounded ${RARITY_COLOR[it.item.rarity]}`}>
                  {RARITY_LABEL[it.item.rarity]}
                </span>
              )}
              <button
                type="button"
                onClick={() => handleFulfill(it.id)}
                className="bg-quest-mint text-white text-xs font-bold px-3 py-1.5 rounded-lg"
              >
                渡したよ
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
