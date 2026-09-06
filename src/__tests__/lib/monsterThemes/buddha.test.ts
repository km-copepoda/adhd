// Issue #73: モンスターテーマセット Stage1 — buddha テーマのデータ定義テスト。
// 対象: src/lib/monsterThemes/buddha.ts (未実装。実装は implementer が行う)
//
// MONSTER_TABLE (@/lib/monsters) と同型・同キー数（39体）のテーブルであること、
// image が /monsters/buddha/ 配下を指すことを検証する。

import { describe, it, expect } from "vitest";
import { MONSTER_TABLE as BUDDHA_TABLE, EGG_STAGE as BUDDHA_EGG_STAGE } from "@/lib/monsterThemes/buddha";
import { MONSTER_TABLE } from "@/lib/monsters";

// Issue #115: 仏様テーマの通常卵も「いしのたまご」に統一する。
describe("BUDDHA_EGG_STAGE (@/lib/monsterThemes/buddha)", () => {
  it("image が /monsters/buddha/egg-stone.webp であること", () => {
    expect(BUDDHA_EGG_STAGE.image).toBe("/monsters/buddha/egg-stone.webp");
  });
});

describe("BUDDHA_TABLE (@/lib/monsterThemes/buddha)", () => {
  it("39体（3+9+27）が定義されていること", () => {
    expect(Object.keys(BUDDHA_TABLE)).toHaveLength(39);
  });

  it("キーが既定(dark)の MONSTER_TABLE と完全一致すること", () => {
    expect(Object.keys(BUDDHA_TABLE).sort()).toEqual(Object.keys(MONSTER_TABLE).sort());
  });

  it("stage1の3パスが全て存在すること", () => {
    for (const path of ["STUDY", "STAMINA", "LIFE"]) {
      expect(BUDDHA_TABLE[path]).toBeDefined();
    }
  });

  it("stage2の9パスが全て存在すること", () => {
    const paths = ["STUDY", "STAMINA", "LIFE"];
    for (const p1 of paths) {
      for (const p2 of paths) {
        expect(BUDDHA_TABLE[`${p1}_${p2}`]).toBeDefined();
      }
    }
  });

  it("stage3の27パスが全て存在すること", () => {
    const paths = ["STUDY", "STAMINA", "LIFE"];
    for (const p1 of paths) {
      for (const p2 of paths) {
        for (const p3 of paths) {
          expect(BUDDHA_TABLE[`${p1}_${p2}_${p3}`]).toBeDefined();
        }
      }
    }
  });

  it("全エントリで image・name・description が空でないこと", () => {
    for (const entry of Object.values(BUDDHA_TABLE)) {
      expect(entry.image.length).toBeGreaterThan(0);
      expect(entry.name.length).toBeGreaterThan(0);
      expect(entry.description.length).toBeGreaterThan(0);
    }
  });

  it("全エントリの image が /monsters/buddha/ 配下であること", () => {
    for (const entry of Object.values(BUDDHA_TABLE)) {
      expect(entry.image).toMatch(/^\/monsters\/buddha\//);
    }
  });

  it("DARKと異なるimage/nameを持つこと（独自のテーマ画像）", () => {
    for (const key of Object.keys(MONSTER_TABLE)) {
      expect(BUDDHA_TABLE[key].image).not.toBe(MONSTER_TABLE[key].image);
      expect(BUDDHA_TABLE[key].name).not.toBe(MONSTER_TABLE[key].name);
    }
  });
});
