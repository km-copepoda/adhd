"use client";

import { useState } from "react";
import CheckinCalendar from "./CheckinCalendar";
import { getCheckinPillLabel, type CheckinTodayStatus } from "@/lib/checkinPill";

interface Props {
  enabled: boolean;
  todayStatus: CheckinTodayStatus;
  currentStreak: number;
  deadline: string;
  todayStr: string;
  justNow?: boolean;
}

/**
 * quests 画面最上部の1行ピル。
 * - 折りたたみ時: ラベル文言のみ表示（GET /api/checkin/calendar は呼ばない）
 * - タップで展開: 初回展開時に初めて `CheckinCalendar variant="embedded"` をマウントし GET を発火する
 * - 一度取得済みの CheckinCalendar は再展開時に再マウントしない（表示は display:none で切り替える）ことで
 *   GET の重複発火を避ける
 */
export default function CheckinPill({
  enabled,
  todayStatus,
  currentStreak,
  deadline,
  todayStr,
  justNow,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [hasExpandedOnce, setHasExpandedOnce] = useState(false);

  const label = getCheckinPillLabel({ enabled, todayStatus, currentStreak });
  if (label === null) return null;

  function handleToggle() {
    setExpanded((prev) => {
      const next = !prev;
      if (next) setHasExpandedOnce(true);
      return next;
    });
  }

  return (
    <div className="mb-4">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={handleToggle}
        className="w-full flex items-center justify-between gap-2 rounded-full bg-quest-card border border-quest-border px-3 py-2 text-xs text-quest-dim"
      >
        <span className="flex-1 text-left">{label}</span>
        <span aria-hidden className="shrink-0 text-quest-dim/60">
          {expanded ? "▲" : "▼"}
        </span>
      </button>
      {hasExpandedOnce && (
        <div style={{ display: expanded ? "block" : "none" }} className="mt-2">
          <CheckinCalendar
            deadline={deadline}
            todayStr={todayStr}
            justNow={justNow}
            variant="embedded"
          />
        </div>
      )}
    </div>
  );
}
