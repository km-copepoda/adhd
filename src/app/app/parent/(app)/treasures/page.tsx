"use client";

import { useCallback, useEffect, useState } from "react";
import LoadingSpinner from "@/components/LoadingSpinner";
import { createClient } from "@/lib/supabase/client";
import ParentTreasureTabs from "@/components/parent/ParentTreasureTabs";
import { RARITY_LABEL, type TreasureRarity } from "@/lib/treasureRarity";

type Rarity = TreasureRarity;

interface ChildOption {
  id: string;
  name: string;
}

interface PoolItem {
  id: string;
  title: string;
  rarity: Rarity;
  sortOrder: number;
  isActive: boolean;
}

export default function ParentTreasuresPage() {
  const [children, setChildren] = useState<ChildOption[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string>("");
  const [items, setItems] = useState<PoolItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [newRarity, setNewRarity] = useState<Rarity>("COMMON");

  // 家族の子供一覧を取得
  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const res = await fetch("/api/family/code", { cache: "no-store" });
      if (!res.ok) return;
      const json = await res.json();
      const list = (json.members ?? [])
        .filter((m: { role: string }) => m.role === "CHILD")
        .map((m: { id: string; name: string | null; monsterName: string | null }) => ({
          id: m.id,
          name: m.monsterName || m.name || "未設定",
        }));
      setChildren(list);
      if (list.length > 0) setSelectedChildId(list[0].id);
    })();
  }, []);

  const fetchItems = useCallback(async (childId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/treasures?childId=${encodeURIComponent(childId)}`, { cache: "no-store" });
      if (!res.ok) {
        setItems([]);
        return;
      }
      const json = await res.json();
      setItems(json.items ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedChildId) void fetchItems(selectedChildId);
  }, [selectedChildId, fetchItems]);

  const handleAdd = async () => {
    const title = newTitle.trim();
    if (!title || !selectedChildId) return;
    const res = await fetch("/api/treasures", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ childId: selectedChildId, title, rarity: newRarity }),
    });
    if (res.ok) {
      setNewTitle("");
      void fetchItems(selectedChildId);
    }
  };

  const handleImport = async () => {
    if (!selectedChildId) return;
    if (!confirm("おすすめのごほうび20件をプールに追加します。よろしいですか？")) return;
    const res = await fetch("/api/treasures/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ childId: selectedChildId }),
    });
    if (res.ok) void fetchItems(selectedChildId);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("このアイテムを削除しますか？（過去の履歴は残ります）")) return;
    const res = await fetch(`/api/treasures/${id}`, { method: "DELETE" });
    if (res.ok) void fetchItems(selectedChildId);
  };

  const handleUpdateRarity = async (id: string, rarity: Rarity) => {
    const res = await fetch(`/api/treasures/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rarity }),
    });
    if (res.ok) void fetchItems(selectedChildId);
  };

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <ParentTreasureTabs active="settings" />

      <h1 className="text-2xl font-bold mb-1">🎁 ごほうび設定</h1>
      <p className="text-sm text-quest-dim mb-4">
        宝箱から出るごほうびを子供ごとに設定します。レア度ごとの確率はシステムが管理します。
      </p>

      {children.length > 0 && (
        <div className="mb-4">
          <label className="block text-xs font-bold mb-1">対象の子供</label>
          <select
            value={selectedChildId}
            onChange={(e) => setSelectedChildId(e.target.value)}
            className="w-full bg-quest-bg border border-quest-border rounded-lg px-3 py-2 text-sm text-quest-text focus:outline-none focus:border-quest-gold/30"
          >
            {children.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="bg-quest-card border border-quest-border rounded-xl p-4 mb-4">
        <div className="text-sm font-bold mb-2">新しいごほうびを追加</div>
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="例: アイスを買える"
            className="flex-1 bg-quest-bg border border-quest-border rounded-lg px-3 py-2 text-sm text-quest-text placeholder:text-quest-dim/50 focus:outline-none focus:border-quest-gold/30"
            maxLength={100}
          />
          <select
            value={newRarity}
            onChange={(e) => setNewRarity(e.target.value as Rarity)}
            className="bg-quest-bg border border-quest-border rounded-lg px-3 py-2 text-sm text-quest-text focus:outline-none focus:border-quest-gold/30"
          >
            <option value="COMMON">よく出る</option>
            <option value="UNCOMMON">ときどき</option>
            <option value="RARE">たまに</option>
          </select>
        </div>
        <button
          type="button"
          onClick={handleAdd}
          disabled={!newTitle.trim() || !selectedChildId}
          className="w-full bg-quest-gold text-quest-bg py-2.5 px-5 rounded-lg font-bold disabled:opacity-40 disabled:cursor-not-allowed"
        >
          追加
        </button>
      </div>

      {items.length === 0 && !loading && (
        <div className="bg-quest-card border border-quest-border rounded-xl p-6 mb-4 text-center">
          <p className="text-sm text-quest-dim mb-3">
            まだごほうびが登録されていません。
          </p>
          <button
            type="button"
            onClick={handleImport}
            className="bg-quest-gold text-quest-bg py-2.5 px-5 rounded-lg font-bold text-sm"
          >
            おすすめセットで始める
          </button>
        </div>
      )}

      {loading ? (
        <LoadingSpinner />
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="bg-quest-card border border-quest-border rounded-lg p-3 flex items-center gap-2"
            >
              <span className="flex-1 text-sm">{item.title}</span>
              <select
                value={item.rarity}
                onChange={(e) => handleUpdateRarity(item.id, e.target.value as Rarity)}
                className="bg-quest-bg border border-quest-border rounded text-xs text-quest-text px-2 py-1 focus:outline-none focus:border-quest-gold/30"
              >
                <option value="COMMON">{RARITY_LABEL.COMMON}</option>
                <option value="UNCOMMON">{RARITY_LABEL.UNCOMMON}</option>
                <option value="RARE">{RARITY_LABEL.RARE}</option>
              </select>
              <button
                type="button"
                onClick={() => handleDelete(item.id)}
                className="text-xs text-red-500 px-2 py-1"
                aria-label="削除"
              >
                削除
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
