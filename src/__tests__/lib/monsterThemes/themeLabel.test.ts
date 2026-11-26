// Issue #262: テーマ ID の正規化とラベル取得（純粋関数）
import { describe, it, expect } from "vitest";
import { MONSTER_THEMES } from "@/lib/monsterThemes/index";
import { resolveMonsterThemeId, getMonsterThemeLabel } from "@/lib/monsterThemes/themeLabel";

describe("resolveMonsterThemeId", () => {
  it.each(Object.keys(MONSTER_THEMES))("全テーマキー %s はそのまま返す", (id) => {
    expect(resolveMonsterThemeId(id)).toBe(id);
  });

  it.each([null, undefined, ""])("%j は dark にフォールバックする", (v) => {
    expect(resolveMonsterThemeId(v as string | null | undefined)).toBe("dark");
  });

  it("未知の id は dark", () => {
    expect(resolveMonsterThemeId("unknown-theme")).toBe("dark");
  });

  it.each(["toString", "constructor", "__proto__", "hasOwnProperty", "valueOf"])(
    "プロトタイプ上のキー %s は dark",
    (key) => {
      expect(resolveMonsterThemeId(key)).toBe("dark");
    }
  );

  it.each(["DARK", "Light", "Buddha"])("大文字違い %s は未知扱いで dark", (v) => {
    expect(resolveMonsterThemeId(v)).toBe("dark");
  });
});

describe("getMonsterThemeLabel", () => {
  it.each(Object.entries(MONSTER_THEMES))("テーマ %s のラベルは MONSTER_THEMES の label", (id, theme) => {
    expect(getMonsterThemeLabel(id)).toBe(theme.label);
  });

  it.each([null, undefined, "", "unknown", "toString", "constructor", "__proto__", "DARK", "Light"])(
    "%j でも必ず文字列（ダーク）を返す",
    (v) => {
      const label = getMonsterThemeLabel(v as string | null | undefined);
      expect(typeof label).toBe("string");
      expect(label).toBe("ダーク");
    }
  );
});
