"use client";

// 親代理（子供モード）— 子供の図鑑＆実績を閲覧する。
// 子供画面 `/app/child/collection` と同じ 2タブ構成（📖 図鑑 / 🏅 実績）を、
// child-view 経路の API + 親モード向けオプション（trackVisit=false, enableRealtime=false）で再利用する。
// 親モードでは BottomNav バッジを変えないため localStorage 書き込みを止め、
// Realtime も切る（2026-05-11 の方針）。

import { useState } from "react";
import { useParams } from "next/navigation";
import ZukanContent from "@/components/child/ZukanContent";
import BadgesContent from "@/components/child/BadgesContent";

type Tab = "zukan" | "badges";

export default function ParentChildViewCollectionPage() {
  const params = useParams<{ childId: string }>();
  const childId = params?.childId ?? "";
  const [tab, setTab] = useState<Tab>("zukan");

  const monsterUrl = `/api/parent/child-view/monster?childId=${encodeURIComponent(childId)}`;
  const badgesUrl = `/api/parent/child-view/badges?childId=${encodeURIComponent(childId)}`;

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

      {tab === "zukan" ? (
        <ZukanContent fetchUrl={monsterUrl} trackVisit={false} />
      ) : (
        <BadgesContent
          fetchUrl={badgesUrl}
          trackVisit={false}
          enableRealtime={false}
        />
      )}
    </div>
  );
}
