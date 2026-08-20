"use client";

import { useState } from "react";
import { MONSTER_THEMES } from "@/lib/monsterThemes/index";

type ThemeSelectorMember = {
  id: string;
  evolutionStage: number;
  rebirthPending: boolean;
  monsterSetId: string;
  pendingMonsterSetId: string | null;
};

type Message = { type: "success" | "pending" | "error"; text: string };

const THEME_IDS = Object.keys(MONSTER_THEMES);

export default function MonsterThemeSelector({
  member,
  ownedThemes,
}: {
  member: ThemeSelectorMember;
  ownedThemes: string[];
}) {
  const [currentThemeId, setCurrentThemeId] = useState(member.monsterSetId);
  const [pendingThemeId, setPendingThemeId] = useState<string | null>(member.pendingMonsterSetId);
  const [message, setMessage] = useState<Message | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSelect(themeId: string) {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/family/members/${member.id}/monster-theme`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ themeId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "テーマの変更に失敗しました" });
        return;
      }
      if (data.immediate) {
        setCurrentThemeId(data.monsterSetId);
        setPendingThemeId(null);
        setMessage({ type: "success", text: "テーマを変更しました" });
      } else {
        setPendingThemeId(data.pendingMonsterSetId);
        setMessage({ type: "pending", text: "次の転生からこのテーマになります" });
      }
    } catch {
      setMessage({ type: "error", text: "通信エラーが発生しました" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      data-testid={`monster-theme-section-${member.id}`}
      className="flex flex-col gap-2"
    >
      <span className="text-[10px] text-quest-dim">🎨 モンスターテーマ</span>

      {pendingThemeId && (
        <p className="text-[10px] text-quest-dim/60">
          いまのテーマ:{" "}
          <span data-testid={`monster-theme-current-${member.id}`} className="text-quest-text">
            {MONSTER_THEMES[currentThemeId]?.label ?? currentThemeId}
          </span>
          {" / "}
          次回:{" "}
          <span data-testid={`monster-theme-pending-${member.id}`} className="text-quest-gold">
            {MONSTER_THEMES[pendingThemeId]?.label ?? pendingThemeId}
          </span>
        </p>
      )}

      <select
        data-testid={`monster-theme-select-${member.id}`}
        value={currentThemeId}
        disabled={saving}
        onChange={(e) => {
          const themeId = e.target.value;
          const theme = MONSTER_THEMES[themeId];
          const isLocked = theme?.isFree === false && !ownedThemes.includes(themeId);
          if (isLocked) return;
          handleSelect(themeId);
        }}
        className="text-[10px] px-2 py-1 rounded border bg-quest-border text-quest-text border-quest-border disabled:opacity-50"
      >
        {THEME_IDS.map((themeId) => {
          const theme = MONSTER_THEMES[themeId];
          const isLocked = theme.isFree === false && !ownedThemes.includes(themeId);
          return (
            <option key={themeId} value={themeId} disabled={isLocked}>
              {isLocked ? `${theme.label} (準備中)` : theme.label}
            </option>
          );
        })}
      </select>

      {message && (
        <p
          className={`text-[10px] ${
            message.type === "error" ? "text-red-400" : "text-quest-dim/60"
          }`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
