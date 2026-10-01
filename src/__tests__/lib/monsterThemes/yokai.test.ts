// モンスターテーマセット — yokai（妖怪）テーマのデータ定義テスト。
// 対象: src/lib/monsterThemes/yokai.ts（.claude/skills/theme-set-import で生成）
//
// MONSTER_TABLE (@/lib/monsters) と同型・同キー数（39体）のテーブルであること、
// image が /monsters/yokai/ 配下の「実在する webp」を指すこと、かな表記がひらがなのみであることを検証する。

import { describe, it, expect } from "vitest";
import { existsSync } from "fs";
import { join } from "path";
import { MONSTER_TABLE as YOKAI_TABLE, EGG_STAGE as YOKAI_EGG_STAGE } from "@/lib/monsterThemes/yokai";
import { MONSTER_TABLE } from "@/lib/monsters";

const PATHS = ["STUDY", "STAMINA", "LIFE"];
// 漢字・カタカナ（長音「ー」は許可）が残っていないこと。「…」「・」などの記号は許可する。
const NON_HIRAGANA = /[一-鿿゠-ヺヽ-ヿ]/;

const publicFile = (imagePath: string) => join(process.cwd(), "public", imagePath);

describe("YOKAI_EGG_STAGE (@/lib/monsterThemes/yokai)", () => {
  it("image が /monsters/yokai/egg.webp であり、実ファイルが存在すること", () => {
    expect(YOKAI_EGG_STAGE.image).toBe("/monsters/yokai/egg.webp");
    expect(existsSync(publicFile(YOKAI_EGG_STAGE.image))).toBe(true);
  });

  it("ptToEvolve が 1 であること（既定テーマの卵と同じ）", () => {
    expect(YOKAI_EGG_STAGE.ptToEvolve).toBe(1);
  });

  it("名前・説明・かな表記が空でなく、かな表記がひらがなのみであること", () => {
    expect(YOKAI_EGG_STAGE.name.length).toBeGreaterThan(0);
    expect(YOKAI_EGG_STAGE.description.length).toBeGreaterThan(0);
    expect(YOKAI_EGG_STAGE.nameKana.length).toBeGreaterThan(0);
    expect(YOKAI_EGG_STAGE.descriptionKana.length).toBeGreaterThan(0);
    expect(YOKAI_EGG_STAGE.nameKana).not.toMatch(NON_HIRAGANA);
    expect(YOKAI_EGG_STAGE.descriptionKana).not.toMatch(NON_HIRAGANA);
  });
});

describe("YOKAI_TABLE (@/lib/monsterThemes/yokai)", () => {
  it("39体（3+9+27）が定義されていること", () => {
    expect(Object.keys(YOKAI_TABLE)).toHaveLength(39);
  });

  it("キーが既定(dark)の MONSTER_TABLE と完全一致すること", () => {
    expect(Object.keys(YOKAI_TABLE).sort()).toEqual(Object.keys(MONSTER_TABLE).sort());
  });

  it("stage1〜3 の全パス（3 / 9 / 27）が存在すること", () => {
    for (const p1 of PATHS) {
      expect(YOKAI_TABLE[p1]).toBeDefined();
      for (const p2 of PATHS) {
        expect(YOKAI_TABLE[`${p1}_${p2}`]).toBeDefined();
        for (const p3 of PATHS) {
          expect(YOKAI_TABLE[`${p1}_${p2}_${p3}`]).toBeDefined();
        }
      }
    }
  });

  it("全エントリで image・name・nameKana・description・descriptionKana が空でないこと", () => {
    for (const [key, entry] of Object.entries(YOKAI_TABLE)) {
      expect(entry.image.length, `${key}.image`).toBeGreaterThan(0);
      expect(entry.name.length, `${key}.name`).toBeGreaterThan(0);
      expect(entry.nameKana.length, `${key}.nameKana`).toBeGreaterThan(0);
      expect(entry.description.length, `${key}.description`).toBeGreaterThan(0);
      expect(entry.descriptionKana.length, `${key}.descriptionKana`).toBeGreaterThan(0);
    }
  });

  it("全エントリの image が /monsters/yokai/ 配下の .webp で、public 内に実ファイルとして存在すること", () => {
    for (const [key, entry] of Object.entries(YOKAI_TABLE)) {
      expect(entry.image, key).toMatch(/^\/monsters\/yokai\/.+\.webp$/);
      expect(existsSync(publicFile(entry.image)), `${key}: ${entry.image}`).toBe(true);
    }
  });

  it("image のファイル名がキー（パス）で始まること（他パスの画像を指していないこと）", () => {
    for (const [key, entry] of Object.entries(YOKAI_TABLE)) {
      const file = entry.image.replace("/monsters/yokai/", "");
      expect(file.startsWith(`${key}_`), `${key}: ${file}`).toBe(true);
      // "STUDY" が "STUDY_STAMINA_xxx.webp" に一致してしまわないよう、キーの直後が次のパス要素でないことも確認
      expect(file.slice(key.length + 1)).not.toMatch(/^(STUDY|STAMINA|LIFE)_/);
    }
  });

  it("同じ画像を複数のエントリが指していないこと", () => {
    const images = Object.values(YOKAI_TABLE).map((e) => e.image);
    expect(new Set(images).size).toBe(images.length);
  });

  it("nameKana / descriptionKana が漢字・カタカナを含まないこと（ひらがなのみ）", () => {
    for (const [key, entry] of Object.entries(YOKAI_TABLE)) {
      expect(entry.nameKana, `${key}.nameKana`).not.toMatch(NON_HIRAGANA);
      expect(entry.descriptionKana, `${key}.descriptionKana`).not.toMatch(NON_HIRAGANA);
    }
  });

  it("DARKと異なる image を持つこと（独自のテーマ画像）", () => {
    for (const key of Object.keys(MONSTER_TABLE)) {
      expect(YOKAI_TABLE[key].image).not.toBe(MONSTER_TABLE[key].image);
    }
  });
});
