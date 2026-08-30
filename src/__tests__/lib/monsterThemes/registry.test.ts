// Issue #73: モンスターテーマセット Stage1 — テーマレジストリのテスト。
// 対象: src/lib/monsterThemes/index.ts (未実装。実装は implementer が行う)
//
// レジストリは id・label・description・thumbnail・eggImage・table・isFree を
// 持つテーマ定義を dark/light/buddha の3件登録する想定。
// dark/light は無料（isFree: true）、buddha は有料（isFree: false）。
//
// NOTE: `src/lib/monsterThemes.ts`（DB操作層、新規ファイル）と
// `src/lib/monsterThemes/index.ts`（データ定義層、このテストの対象）は別ファイル。
// Node/TS のモジュール解決では拡張子付きファイルがディレクトリの index より優先されるため、
// `@/lib/monsterThemes` は DB操作層に解決される。データ定義層を参照する場合は
// 必ず `@/lib/monsterThemes/index` を明示的にインポートすること。

import { describe, it, expect } from "vitest";
import { MONSTER_THEMES } from "@/lib/monsterThemes/index";
import { MONSTER_TABLE } from "@/lib/monsters";
import { MONSTER_TABLE as BUDDHA_TABLE } from "@/lib/monsterThemes/buddha";

describe("MONSTER_THEMES registry", () => {
  it("dark/light/buddha の3テーマが登録されていること", () => {
    expect(Object.keys(MONSTER_THEMES).sort()).toEqual(["buddha", "dark", "light"]);
  });

  it("各テーマに id・label・description・thumbnail・eggImage・table・isFree が定義されていること", () => {
    for (const [key, theme] of Object.entries(MONSTER_THEMES)) {
      expect(theme.id).toBe(key);
      expect(theme.label.length).toBeGreaterThan(0);
      expect(theme.description.length).toBeGreaterThan(0);
      expect(theme.thumbnail.length).toBeGreaterThan(0);
      expect(theme.eggImage.length).toBeGreaterThan(0);
      expect(typeof theme.table).toBe("object");
      expect(typeof theme.isFree).toBe("boolean");
    }
  });

  it("dark は isFree=true であること", () => {
    expect(MONSTER_THEMES.dark.isFree).toBe(true);
  });

  it("light は isFree=true であること", () => {
    expect(MONSTER_THEMES.light.isFree).toBe(true);
  });

  it("buddha は isFree=false であること", () => {
    expect(MONSTER_THEMES.buddha.isFree).toBe(false);
  });

  it("dark の table が既定の MONSTER_TABLE と同じ39キーであること", () => {
    expect(Object.keys(MONSTER_THEMES.dark.table).sort()).toEqual(Object.keys(MONSTER_TABLE).sort());
  });

  it("buddha の table が @/lib/monsterThemes/buddha の BUDDHA_TABLE と同じ39キーであること", () => {
    expect(Object.keys(MONSTER_THEMES.buddha.table).sort()).toEqual(Object.keys(BUDDHA_TABLE).sort());
  });

  it("buddha の eggImage が /monsters/buddha/egg-stone.webp であること（Issue #115: いしのたまご化）", () => {
    expect(MONSTER_THEMES.buddha.eggImage).toBe("/monsters/buddha/egg-stone.webp");
  });

  it("存在しないテーマidにアクセスした場合は undefined であること", () => {
    expect(MONSTER_THEMES["nonexistent-theme"]).toBeUndefined();
  });

  // ─── Issue #115 → #119: 転生卵（rebirthEggImages）のテーマ追従 ──────────
  // Issue #119: buddha のカテゴリ卵(STUDY/STAMINA/LIFE)は石卵4種並びの視認性問題により
  // dark/light と同じ既定の色卵に戻す。rebirthEggImages 自体を持たないことで
  // getRebirthEggImage が DEFAULT_REBIRTH_EGG_IMAGES にフォールバックする。
  describe("rebirthEggImages（Issue #115 → #119で色卵に戻す）", () => {
    it("buddha の rebirthEggImages は未定義であること（Issue #119: 既定マップへのフォールバック確認用）", () => {
      expect(MONSTER_THEMES.buddha.rebirthEggImages).toBeUndefined();
    });

    it("dark は rebirthEggImages が未定義であること（既定マップへのフォールバック確認用）", () => {
      expect(MONSTER_THEMES.dark.rebirthEggImages).toBeUndefined();
    });

    it("light は rebirthEggImages が未定義であること（既定マップへのフォールバック確認用）", () => {
      expect(MONSTER_THEMES.light.rebirthEggImages).toBeUndefined();
    });
  });
});
