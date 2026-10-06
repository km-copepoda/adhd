"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import LoadingSpinner from "@/components/LoadingSpinner";
import ParentTreasureTabs from "@/components/parent/ParentTreasureTabs";
import TreasureUseConfirmModal from "@/components/parent/TreasureUseConfirmModal";
import { formatTreasureOpenedAt } from "@/lib/treasureHistory";
import {
  RARITY_LABEL,
  RARITY_BADGE_CLASS,
  type TreasureRarity,
} from "@/lib/treasureRarity";

type TreasureUseStatus = "UNUSED" | "USE_REQUESTED" | "USED";

interface HistoryItem {
  id: string;
  openedAt: string;
  item: { id: string; title: string; rarity: TreasureRarity } | null;
  child: { id: string; name: string | null; monsterName: string | null };
  fulfilled: boolean;
  // #151: ごほうび使用申請の親承認フロー用ステータス。
  useStatus?: TreasureUseStatus;
  // #72: 子画面（保持期間30日）で見えるかの計算値。false の行はグレーアウト表示する。
  visibleToChild?: boolean;
}

interface ChildOption {
  id: string;
  name: string | null;
  monsterName: string | null;
}

export default function ParentTreasureHistoryPage() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [children, setChildren] = useState<ChildOption[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<HistoryItem | null>(null);

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

  const fetchChildren = useCallback(async () => {
    const res = await fetch("/api/family/code", { cache: "no-store" });
    if (!res.ok) return;
    const json = await res.json();
    const list: ChildOption[] = (json.members ?? [])
      .filter((m: { role: string }) => m.role === "CHILD")
      .map((m: { id: string; name: string | null; monsterName: string | null }) => ({
        id: m.id,
        name: m.name,
        monsterName: m.monsterName,
      }));
    setChildren(list);
    setSelectedChildId((prev) => prev ?? list[0]?.id ?? null);
  }, []);

  useEffect(() => {
    void fetchItems();
    void fetchChildren();
  }, [fetchItems, fetchChildren]);

  const filteredItems = useMemo(() => {
    if (children.length <= 1 || !selectedChildId) return items;
    return items.filter((it) => it.child.id === selectedChildId);
  }, [items, children.length, selectedChildId]);

  // #151: 「使用済み(USED)の取り消し」専用。承認/却下は承認センター（/app/parent/approve）の責務。
  async function revokeUse(id: string) {
    setPendingId(id);
    // optimistic update
    setItems((arr) => arr.map((i) => (i.id === id ? { ...i, useStatus: "UNUSED", fulfilled: false } : i)));
    try {
      const res = await fetch(`/api/treasures/fulfill/${id}`, { method: "POST" });
      if (!res.ok) {
        // 失敗したら元に戻す
        setItems((arr) => arr.map((i) => (i.id === id ? { ...i, useStatus: "USED", fulfilled: true } : i)));
      }
    } catch {
      setItems((arr) => arr.map((i) => (i.id === id ? { ...i, useStatus: "USED", fulfilled: true } : i)));
    } finally {
      setPendingId(null);
    }
  }

  // #164: 親が承認なしで直接「使用済み」にする。失敗時は操作前の useStatus / fulfilled に戻す。
  async function markUsedDirectly(target: HistoryItem) {
    const { id } = target;
    const prevUseStatus: TreasureUseStatus = target.useStatus ?? (target.fulfilled ? "USED" : "UNUSED");
    const prevFulfilled = target.fulfilled;
    setConfirmTarget(null);
    setPendingId(id);
    setItems((arr) => arr.map((i) => (i.id === id ? { ...i, useStatus: "USED", fulfilled: true } : i)));
    const rollback = () =>
      setItems((arr) =>
        arr.map((i) => (i.id === id ? { ...i, useStatus: prevUseStatus, fulfilled: prevFulfilled } : i)),
      );
    try {
      const res = await fetch(`/api/treasures/use/${id}`, { method: "POST" });
      if (!res.ok) rollback();
    } catch {
      rollback();
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <ParentTreasureTabs active="history" />

      <h1 className="text-2xl font-bold mb-1">🎁 もらったごほうび</h1>
      <p className="text-sm text-quest-dim mb-4">
        子供が宝箱から引き当てたごほうびの履歴です。子供が「つかう」を申請すると承認センターに届き、承認すると「使用済み」になります。使用承認の取り消しはここからできます。
      </p>

      {children.length > 1 && (
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {children.map((child) => (
            <button
              key={child.id}
              type="button"
              onClick={() => setSelectedChildId(child.id)}
              className={[
                "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs whitespace-nowrap transition-colors",
                selectedChildId === child.id
                  ? "bg-quest-gold/15 border border-quest-gold text-quest-gold"
                  : "bg-quest-card border border-quest-border text-quest-dim hover:text-quest-text",
              ].join(" ")}
            >
              🧒 {child.monsterName || child.name || "名前未設定"}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <LoadingSpinner />
      ) : filteredItems.length === 0 ? (
        <div className="bg-quest-card border border-quest-border rounded-xl p-6 text-center">
          <p className="text-sm text-quest-dim">まだもらったごほうびはありません。</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {filteredItems.map((it) => {
            // #151: useStatus が未取得の旧レスポンス互換として fulfilled から導出
            const useStatus: TreasureUseStatus = it.useStatus ?? (it.fulfilled ? "USED" : "UNUSED");
            return (
              <li
                key={it.id}
                className={`bg-quest-card border border-quest-border rounded-lg p-3 flex items-center gap-3${
                  it.visibleToChild === false ? " opacity-50" : ""
                }`}
              >
                <div className="flex-1">
                  <div className="text-xs text-quest-dim flex items-center gap-2 flex-wrap">
                    <span>{it.child.monsterName ?? it.child.name ?? "子供"}</span>
                    {it.openedAt && <span>{formatTreasureOpenedAt(it.openedAt)}</span>}
                    {useStatus === "USED" && <span className="text-quest-mint">✅ 使用済み</span>}
                    {useStatus === "USE_REQUESTED" && (
                      <span className="text-amber-400">⏳ 使用申請中</span>
                    )}
                    {useStatus === "UNUSED" && <span className="text-quest-dim">未使用</span>}
                    {it.visibleToChild === false && (
                      <span className="text-quest-dim">🚫 子画面では非表示</span>
                    )}
                  </div>
                  <div className="font-bold">{it.item?.title ?? "—"}</div>
                </div>
                {it.item && (
                  <span className={`text-xs px-2 py-1 rounded ${RARITY_BADGE_CLASS[it.item.rarity]}`}>
                    {RARITY_LABEL[it.item.rarity]}
                  </span>
                )}
                {(useStatus === "UNUSED" || useStatus === "USE_REQUESTED") &&
                  it.item &&
                  it.visibleToChild !== false && (
                    <button
                      type="button"
                      onClick={() => setConfirmTarget(it)}
                      disabled={pendingId === it.id}
                      className="text-xs px-3 py-1.5 rounded font-bold transition-colors disabled:opacity-50 bg-quest-gold/15 border border-quest-gold text-quest-gold"
                    >
                      つかった
                    </button>
                  )}
                {useStatus === "USED" && (
                  <button
                    type="button"
                    onClick={() => revokeUse(it.id)}
                    disabled={pendingId === it.id}
                    className="text-xs px-3 py-1.5 rounded font-bold transition-colors disabled:opacity-50 bg-quest-card border border-quest-border text-quest-dim hover:text-quest-text"
                  >
                    使用を取り消す
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {confirmTarget && (
        <TreasureUseConfirmModal
          title={confirmTarget.item?.title ?? "このごほうび"}
          onCancel={() => setConfirmTarget(null)}
          onConfirm={() => void markUsedDirectly(confirmTarget)}
        />
      )}
    </div>
  );
}
