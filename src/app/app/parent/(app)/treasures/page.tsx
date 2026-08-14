"use client";

import { useCallback, useEffect, useState } from "react";
import LoadingSpinner from "@/components/LoadingSpinner";
import { createClient } from "@/lib/supabase/client";
import ParentTreasureTabs from "@/components/parent/ParentTreasureTabs";
import { RARITY_LABEL, type TreasureRarity } from "@/lib/treasureRarity";
import { alertOnApiError } from "@/lib/apiError";

type Rarity = TreasureRarity;

interface ChildOption {
  id: string;
  name: string;
  monsterName: string | null;
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
  const [plan, setPlan] = useState<"FREE" | "PREMIUM">("PREMIUM");
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
          monsterName: m.monsterName,
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
      if (json.plan === "FREE" || json.plan === "PREMIUM") setPlan(json.plan);
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
    if (!(await alertOnApiError(res))) return;
    setNewTitle("");
    void fetchItems(selectedChildId);
  };

  const handleImport = async () => {
    if (!selectedChildId) return;
    if (!confirm("おすすめのごほうび20件をプールに追加します。よろしいですか？")) return;
    const res = await fetch("/api/treasures/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ childId: selectedChildId }),
    });
    if (!(await alertOnApiError(res))) return;
    void fetchItems(selectedChildId);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("このアイテムを削除しますか？（過去の履歴は残ります）")) return;
    const res = await fetch(`/api/treasures/${id}`, { method: "DELETE" });
    if (!(await alertOnApiError(res))) return;
    void fetchItems(selectedChildId);
  };

  const handleUpdateRarity = async (id: string, rarity: Rarity) => {
    const res = await fetch(`/api/treasures/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rarity }),
    });
    if (!(await alertOnApiError(res))) return;
    void fetchItems(selectedChildId);
  };

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <ParentTreasureTabs active="settings" />

      <h1 className="text-2xl font-bold mb-1">🎁 ごほうび設定</h1>
      <p className="text-sm text-quest-dim mb-2">
        宝箱から出るごほうびを子供ごとに設定します。レア度ごとの確率はシステムが管理します。
      </p>
      <p className="text-xs text-quest-dim/80 mb-4">
        ℹ️ 親が「子供モード」で代理報告した場合も、1日のタスク達成数が条件を満たせば宝箱がもらえます（その日に子供本人の報告で宝箱を獲得済みのときは重複しません）。
      </p>

      {children.length > 1 && (
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {children.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelectedChildId(c.id)}
              className={[
                "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs whitespace-nowrap transition-colors",
                selectedChildId === c.id
                  ? "bg-quest-gold/15 border border-quest-gold text-quest-gold"
                  : "bg-quest-card border border-quest-border text-quest-dim hover:text-quest-text",
              ].join(" ")}
            >
              🧒 {c.name}
            </button>
          ))}
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
          {plan === "PREMIUM" && (
            <button
              type="button"
              onClick={handleImport}
              className="bg-quest-gold text-quest-bg py-2.5 px-5 rounded-lg font-bold text-sm"
            >
              おすすめセットで始める
            </button>
          )}
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
