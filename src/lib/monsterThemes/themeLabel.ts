import { MONSTER_THEMES } from "@/lib/monsterThemes/index";

const FALLBACK_THEME_ID = "dark";

/** MONSTER_THEMES の自前キーのみ許可し、それ以外（null/未知/プロトタイプ上のキー）は "dark" にする */
export function resolveMonsterThemeId(themeId: string | null | undefined): string {
  if (typeof themeId === "string" && Object.hasOwn(MONSTER_THEMES, themeId)) {
    return themeId;
  }
  return FALLBACK_THEME_ID;
}

export function getMonsterThemeLabel(themeId: string | null | undefined): string {
  return MONSTER_THEMES[resolveMonsterThemeId(themeId)].label;
}
