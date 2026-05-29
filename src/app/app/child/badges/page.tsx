"use client";

// 実績ページ本体は `src/components/child/BadgesContent.tsx` に移動。
// `/app/child/collection` のタブからも同じ内容を表示するため共有化している。
// このルート（旧パス）は通知リンクや既存ブックマーク救済のため残置。
// 既存の「🏅 実績 / 🎁 ごほうび」サブタブ切替もここで継続提供する。

import { useState } from "react";
import BadgesContent from "@/components/child/BadgesContent";
import TreasureHistoryList from "@/components/child/TreasureHistoryList";

type TopTab = "badges" | "treasures";

export default function BadgesPage() {
  const [topTab, setTopTab] = useState<TopTab>("badges");

  const base = "flex-1 text-sm py-1.5 rounded-md font-bold tracking-wider transition-colors";
  const active = "bg-quest-gold/20 text-quest-gold border border-quest-gold/30";
  const inactive = "text-quest-dim hover:text-quest-text";

  return (
    <div className="min-h-screen bg-quest-bg pb-24">
      <div className="sticky top-0 z-10 bg-quest-bg/95 backdrop-blur border-b border-quest-border px-4 py-3">
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setTopTab("badges")}
            className={`${base} ${topTab === "badges" ? active : inactive}`}
          >
            🏅 実績
          </button>
          <button
            type="button"
            onClick={() => setTopTab("treasures")}
            className={`${base} ${topTab === "treasures" ? active : inactive}`}
          >
            🎁 ごほうび
          </button>
        </div>
      </div>

      {topTab === "badges" ? <BadgesContent /> : <TreasureHistoryList />}
    </div>
  );
}
