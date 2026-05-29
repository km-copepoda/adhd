"use client";

// 子供向け「コレクション」ページ。
// 旧 `/app/child/zukan` と `/app/child/badges` の内容をタブ切替で 1画面に統合。
//
// タブ構成（仕様 docs/child-footer-redesign.md からの暫定差し替え）:
//  - 📖 図鑑   — ZukanContent
//  - 🏅 実績   — BadgesContent
// 仕様書には「図鑑 + 宝箱アイテム」と書かれているが、collection-items spec が
// 未実装のため、当面は「図鑑 + 実績」の 2タブで運用する（決定: docs/decisions.md）。

import { useState } from "react";
import ZukanContent from "@/components/child/ZukanContent";
import BadgesContent from "@/components/child/BadgesContent";

type Tab = "zukan" | "badges";

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
            onClick={() => setTab("badges")}
            className={`${base} ${tab === "badges" ? active : inactive}`}
          >
            🏅 実績
          </button>
        </div>
      </div>

      {tab === "zukan" ? <ZukanContent /> : <BadgesContent />}
    </div>
  );
}
