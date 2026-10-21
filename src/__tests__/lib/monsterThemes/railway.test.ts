// railway テーマ（電車セット）のデータ定義テスト。
// 対象: src/lib/monsterThemes/railway.ts
// 39体（3+9+27）+ 卵、画像の実在、影画像の実在、かな表記の整合を検証する。

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { MONSTER_TABLE as RAILWAY_TABLE, EGG_STAGE as RAILWAY_EGG_STAGE } from "@/lib/monsterThemes/railway";
import { MONSTER_TABLE } from "@/lib/monsters";

const PUBLIC_DIR = path.join(process.cwd(), "public");
const AXES = ["STUDY", "STAMINA", "LIFE"];
// 漢字・カタカナ（長音「ー」U+30FC は許可するため ァ-ヺ に限定）
const KANJI_OR_KATAKANA = /[一-鿿ァ-ヺヽヾ]/;

const toFile = (image: string) => path.join(PUBLIC_DIR, image);
const toShadow = (image: string) => image.replace("/monsters/", "/monsters/shadow/");

describe("RAILWAY_EGG_STAGE (@/lib/monsterThemes/railway)", () => {
  it("image が /monsters/railway/egg.webp であること", () => {
    expect(RAILWAY_EGG_STAGE.image).toBe("/monsters/railway/egg.webp");
  });

  it("name・description・かな版が空でなく、かな版に漢字・カタカナが残っていないこと", () => {
    expect(RAILWAY_EGG_STAGE.name.length).toBeGreaterThan(0);
    expect(RAILWAY_EGG_STAGE.description.length).toBeGreaterThan(0);
    expect(RAILWAY_EGG_STAGE.nameKana).not.toMatch(KANJI_OR_KATAKANA);
    expect(RAILWAY_EGG_STAGE.descriptionKana).not.toMatch(KANJI_OR_KATAKANA);
    expect(RAILWAY_EGG_STAGE.nameKana.length).toBeGreaterThan(0);
    expect(RAILWAY_EGG_STAGE.descriptionKana.length).toBeGreaterThan(0);
  });

  it("卵の画像と影画像が public/ に実在すること", () => {
    expect(fs.existsSync(toFile(RAILWAY_EGG_STAGE.image))).toBe(true);
    expect(fs.existsSync(toFile(toShadow(RAILWAY_EGG_STAGE.image)))).toBe(true);
  });
});

describe("RAILWAY_TABLE (@/lib/monsterThemes/railway)", () => {
  it("39体（3+9+27）が定義されていること", () => {
    expect(Object.keys(RAILWAY_TABLE)).toHaveLength(39);
  });

  it("キーが既定(dark)の MONSTER_TABLE と完全一致すること", () => {
    expect(Object.keys(RAILWAY_TABLE).sort()).toEqual(Object.keys(MONSTER_TABLE).sort());
  });

  it("stage1の3パスが全て存在すること", () => {
    for (const p of AXES) expect(RAILWAY_TABLE[p]).toBeDefined();
  });

  it("stage2の9パスが全て存在すること", () => {
    for (const p1 of AXES) for (const p2 of AXES) expect(RAILWAY_TABLE[`${p1}_${p2}`]).toBeDefined();
  });

  it("stage3の27パスが全て存在すること", () => {
    for (const p1 of AXES)
      for (const p2 of AXES)
        for (const p3 of AXES) expect(RAILWAY_TABLE[`${p1}_${p2}_${p3}`]).toBeDefined();
  });

  it("全エントリで image・name・nameKana・description・descriptionKana が空でないこと", () => {
    for (const entry of Object.values(RAILWAY_TABLE)) {
      expect(entry.image.length).toBeGreaterThan(0);
      expect(entry.name.length).toBeGreaterThan(0);
      expect(entry.nameKana.length).toBeGreaterThan(0);
      expect(entry.description.length).toBeGreaterThan(0);
      expect(entry.descriptionKana.length).toBeGreaterThan(0);
    }
  });

  it("全エントリの image が /monsters/railway/ 配下であること", () => {
    for (const entry of Object.values(RAILWAY_TABLE)) {
      expect(entry.image).toMatch(/^\/monsters\/railway\//);
    }
  });

  it("全エントリの image が public/ に実ファイルとして存在すること", () => {
    for (const [key, entry] of Object.entries(RAILWAY_TABLE)) {
      expect(fs.existsSync(toFile(entry.image)), `${key}: ${entry.image}`).toBe(true);
    }
  });

  it("全エントリの影画像(/monsters/shadow/railway/)が public/ に実在すること", () => {
    for (const [key, entry] of Object.entries(RAILWAY_TABLE)) {
      expect(fs.existsSync(toFile(toShadow(entry.image))), `${key}: ${toShadow(entry.image)}`).toBe(true);
    }
  });

  it("全エントリの画像ファイル名のパス接頭辞がテーブルキーと一致すること", () => {
    for (const [key, entry] of Object.entries(RAILWAY_TABLE)) {
      const base = path.basename(entry.image);
      expect(base.startsWith(`${key}_`), `${key}: ${base}`).toBe(true);
    }
  });

  it("nameKana・descriptionKana に漢字・カタカナが残っていないこと", () => {
    for (const [key, entry] of Object.entries(RAILWAY_TABLE)) {
      expect(entry.nameKana, `${key}.nameKana`).not.toMatch(KANJI_OR_KATAKANA);
      expect(entry.descriptionKana, `${key}.descriptionKana`).not.toMatch(KANJI_OR_KATAKANA);
    }
  });

  it("nameKana・descriptionKana にアルファベット・数字が残っていないこと", () => {
    for (const [key, entry] of Object.entries(RAILWAY_TABLE)) {
      expect(entry.nameKana, `${key}.nameKana`).not.toMatch(/[A-Za-z0-9]/);
      expect(entry.descriptionKana, `${key}.descriptionKana`).not.toMatch(/[A-Za-z0-9]/);
    }
  });

  it("DARKと異なる image/name を持つこと（独自のテーマ画像）", () => {
    for (const key of Object.keys(MONSTER_TABLE)) {
      expect(RAILWAY_TABLE[key].image).not.toBe(MONSTER_TABLE[key].image);
      expect(RAILWAY_TABLE[key].name).not.toBe(MONSTER_TABLE[key].name);
    }
  });

  it("同じ画像が複数のパスに割り当てられていないこと", () => {
    const images = Object.values(RAILWAY_TABLE).map((e) => e.image);
    expect(new Set(images).size).toBe(images.length);
  });
});
