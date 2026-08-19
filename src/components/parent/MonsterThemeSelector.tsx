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

export default function MonsterThemeSelector({ member }: { member: ThemeSelectorMember }) {
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

      <div className="flex gap-2">
        {THEME_IDS.map((themeId) => {
          const theme = MONSTER_THEMES[themeId];
          const isSelected = themeId === currentThemeId;
          const isLocked = theme.isFree === false;
          return (
            <button
              key={themeId}
              type="button"
              data-testid={`monster-theme-option-${member.id}-${themeId}`}
              aria-pressed={isSelected}
              disabled={saving || isLocked}
              onClick={() => handleSelect(themeId)}
              title={isLocked ? "準備中（近日対応予定）" : undefined}
              className={`flex-1 text-[10px] px-2 py-1 rounded border transition-colors disabled:opacity-50 ${
                isSelected
                  ? "bg-quest-gold/20 text-quest-gold border-quest-gold/30"
                  : "bg-quest-border text-quest-dim border-quest-border hover:text-quest-text"
              }`}
            >
              {theme.label}
              {isLocked && <span className="ml-1 text-quest-dim/60">(準備中)</span>}
            </button>
          );
        })}
      </div>

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
