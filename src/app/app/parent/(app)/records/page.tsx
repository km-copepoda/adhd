"use client";

import { useState } from "react";
import CompletedContent from "@/components/parent/CompletedContent";
import HistoryContent from "@/components/parent/HistoryContent";

type Tab = "today" | "past";

export default function RecordsPage() {
  const [tab, setTab] = useState<Tab>("today");

  const base =
    "flex-1 text-sm py-1.5 rounded-md font-bold tracking-wider transition-colors";
  const active = "bg-quest-gold/20 text-quest-gold border border-quest-gold/30";
  const inactive = "text-quest-dim hover:text-quest-text";

  return (
    <div>
      <div className="sticky top-0 z-10 bg-quest-bg/95 backdrop-blur border-b border-quest-border py-3 mb-4">
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setTab("today")}
            className={`${base} ${tab === "today" ? active : inactive}`}
          >
            🏆 今日
          </button>
          <button
            type="button"
            onClick={() => setTab("past")}
            className={`${base} ${tab === "past" ? active : inactive}`}
          >
            📅 過去
          </button>
        </div>
      </div>

      {tab === "today" ? <CompletedContent /> : <HistoryContent />}
    </div>
  );
}
