"use client";

// 子供向け「コレクション」ページ。
// タブ構成 (仕様書原案: 図鑑 + 宝箱アイテム + 実績):
//  - 📖 図鑑     — ZukanContent
//  - 🎁 アイテム — ItemsContent (宝箱で親ごほうび不当選時に獲得するコレクションアイテム)
//  - 🏅 実績     — BadgesContent

import { useState } from "react";
import ZukanContent from "@/components/child/ZukanContent";
import BadgesContent from "@/components/child/BadgesContent";
import ItemsContent from "@/components/child/ItemsContent";

type Tab = "zukan" | "items" | "badges";

export default function CollectionPage() {
  const [tab, setTab] = useState<Tab>("zukan");

  const base =
    "flex-1 text-sm py-1.5 rounded-md font-bold tracking-wider transition-colors";
  const active = "bg-quest-gold/20 text-quest-gold border border-quest-gold/30";
  const inactive = "text-quest-dim hover:text-quest-text";

  return (
    <div className="min-h-screen bg-quest-bg pb-24">
      <div className="sticky top-0 z-10 bg-quest-bg/95 backdrop-blur border-b border-quest-border px-4 py-3">
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setTab("zukan")}
            className={`${base} ${tab === "zukan" ? active : inactive}`}
          >
            📖 図鑑
          </button>
          <button
            type="button"
            onClick={() => setTab("items")}
            className={`${base} ${tab === "items" ? active : inactive}`}
          >
            🎁 アイテム
          </button>
          <button
            type="button"
            onClick={() => setTab("badges")}
            className={`${base} ${tab === "badges" ? active : inactive}`}
          >
            🏅 実績
          </button>
        </div>
      </div>

      {tab === "zukan" && <ZukanContent />}
      {tab === "items" && <ItemsContent />}
      {tab === "badges" && <BadgesContent />}
    </div>
  );
}
