// Issue #139: モンスター図鑑・コレクションアイテムのかなデータ層
//
// 1. 元データ docs/資料系/モンスター・コレクションかな.csv を parseKanaCsv でパースし、
//    source別のレコード数が想定どおりであることを検証する（データ整合性テスト）。
// 2. MONSTER_TABLE / EGG_STAGE / getMonsterStage のフォールバックに
//    nameKana / descriptionKana フィールドが実装されていることを検証する
//    （実装前の現時点では存在しないため red、実装後に green になる）。

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseKanaCsv } from "@/lib/monsterKanaMerge";
import { MONSTER_TABLE, MONSTER_TABLE_LIGHT, EGG_STAGE, getMonsterStage } from "@/lib/monsters";
import { MONSTER_TABLE as BUDDHA_MONSTER_TABLE } from "@/lib/monsterThemes/buddha";

const CSV_PATH = path.join(
  process.cwd(),
  "docs",
  "資料系",
  "モンスター・コレクションかな.csv",
);

const KANJI_PATTERN = /[一-鿿]/;

describe("モンスター・コレクションかなCSV データ整合性", () => {
  it("CSVが正しくパースできる", () => {
    const csvText = readFileSync(CSV_PATH, "utf-8");
    const result = parseKanaCsv(csvText);
    expect(result.ok).toBe(true);
  });

  it("monsters_dark_table のレコード数が39件である", () => {
    const csvText = readFileSync(CSV_PATH, "utf-8");
    const result = parseKanaCsv(csvText);
    if (!result.ok) throw new Error("CSVのパースに失敗した");
    const records = result.records.filter((r) => r.source === "monsters_dark_table");
    expect(records).toHaveLength(39);
  });

  it("monsters_dark_egg のレコード数が1件である", () => {
    const csvText = readFileSync(CSV_PATH, "utf-8");
    const result = parseKanaCsv(csvText);
    if (!result.ok) throw new Error("CSVのパースに失敗した");
    const records = result.records.filter((r) => r.source === "monsters_dark_egg");
    expect(records).toHaveLength(1);
  });

  it("monsters_dark_table の全レコードがMONSTER_TABLEの実際のname/descriptionと一致する", () => {
    const csvText = readFileSync(CSV_PATH, "utf-8");
    const result = parseKanaCsv(csvText);
    if (!result.ok) throw new Error("CSVのパースに失敗した");
    const records = result.records.filter((r) => r.source === "monsters_dark_table");
    for (const record of records) {
      const entry = MONSTER_TABLE[record.key];
      expect(entry, `MONSTER_TABLE["${record.key}"] が存在しない`).toBeDefined();
      expect(record.name).toBe(entry.name);
      expect(record.description).toBe(entry.description);
    }
  });
});

describe("MONSTER_TABLE / EGG_STAGE のかなフィールド（実装後にgreenになる想定）", () => {
  it("MONSTER_TABLEの全エントリにnameKana/descriptionKanaが存在し非空である", () => {
    for (const key of Object.keys(MONSTER_TABLE)) {
      const entry = MONSTER_TABLE[key] as unknown as {
        nameKana?: string;
        descriptionKana?: string;
      };
      expect(entry.nameKana, `MONSTER_TABLE["${key}"].nameKana`).toBeTruthy();
      expect(entry.descriptionKana, `MONSTER_TABLE["${key}"].descriptionKana`).toBeTruthy();
    }
  });

  it("MONSTER_TABLEのnameKana/descriptionKanaに漢字が残っていない", () => {
    for (const key of Object.keys(MONSTER_TABLE)) {
      const entry = MONSTER_TABLE[key] as unknown as {
        nameKana?: string;
        descriptionKana?: string;
      };
      expect(entry.nameKana ?? "").not.toMatch(KANJI_PATTERN);
      expect(entry.descriptionKana ?? "").not.toMatch(KANJI_PATTERN);
    }
  });

  it("EGG_STAGEにnameKana/descriptionKanaが存在し非空である", () => {
    const egg = EGG_STAGE as unknown as { nameKana?: string; descriptionKana?: string };
    expect(egg.nameKana).toBeTruthy();
    expect(egg.descriptionKana).toBeTruthy();
  });

  it("getMonsterStageの未知evolutionPathフォールバックにnameKana/descriptionKanaが含まれる", () => {
    const stage = getMonsterStage(1, "UNKNOWN_PATH_XYZ", "dark") as unknown as {
      name: string;
      nameKana?: string;
      descriptionKana?: string;
    };
    expect(stage.name).toBe("???");
    expect(stage.nameKana).toBeTruthy();
    expect(stage.descriptionKana).toBeDefined();
  });

  it("MONSTER_TABLE_LIGHTが39件であり、全エントリにnameKana/descriptionKanaが存在し非空である", () => {
    const keys = Object.keys(MONSTER_TABLE_LIGHT);
    expect(keys).toHaveLength(39);
    for (const key of keys) {
      const entry = MONSTER_TABLE_LIGHT[key] as unknown as {
        nameKana?: string;
        descriptionKana?: string;
      };
      expect(entry.nameKana, `MONSTER_TABLE_LIGHT["${key}"].nameKana`).toBeTruthy();
      expect(entry.descriptionKana, `MONSTER_TABLE_LIGHT["${key}"].descriptionKana`).toBeTruthy();
    }
  });

  it("MONSTER_TABLE_LIGHTのnameKana/descriptionKanaに漢字が残っていない", () => {
    for (const key of Object.keys(MONSTER_TABLE_LIGHT)) {
      const entry = MONSTER_TABLE_LIGHT[key] as unknown as {
        nameKana?: string;
        descriptionKana?: string;
      };
      expect(entry.nameKana ?? "").not.toMatch(KANJI_PATTERN);
      expect(entry.descriptionKana ?? "").not.toMatch(KANJI_PATTERN);
    }
  });

  it("buddhaテーマのMONSTER_TABLEが39件であり、全エントリにnameKana/descriptionKanaが存在し非空である", () => {
    const keys = Object.keys(BUDDHA_MONSTER_TABLE);
    expect(keys).toHaveLength(39);
    for (const key of keys) {
      const entry = BUDDHA_MONSTER_TABLE[key] as unknown as {
        nameKana?: string;
        descriptionKana?: string;
      };
      expect(entry.nameKana, `BUDDHA_MONSTER_TABLE["${key}"].nameKana`).toBeTruthy();
      expect(entry.descriptionKana, `BUDDHA_MONSTER_TABLE["${key}"].descriptionKana`).toBeTruthy();
    }
  });

  it("buddhaテーマのMONSTER_TABLEのnameKana/descriptionKanaに漢字が残っていない", () => {
    for (const key of Object.keys(BUDDHA_MONSTER_TABLE)) {
      const entry = BUDDHA_MONSTER_TABLE[key] as unknown as {
        nameKana?: string;
        descriptionKana?: string;
      };
      expect(entry.nameKana ?? "").not.toMatch(KANJI_PATTERN);
      expect(entry.descriptionKana ?? "").not.toMatch(KANJI_PATTERN);
    }
  });

  it("dark/light/buddhaの3テーマ間でMONSTER_TABLEのキー集合が一致している", () => {
    const darkKeys = Object.keys(MONSTER_TABLE).sort();
    const lightKeys = Object.keys(MONSTER_TABLE_LIGHT).sort();
    const buddhaKeys = Object.keys(BUDDHA_MONSTER_TABLE).sort();

    expect(lightKeys).toEqual(darkKeys);
    expect(buddhaKeys).toEqual(darkKeys);
  });
});
