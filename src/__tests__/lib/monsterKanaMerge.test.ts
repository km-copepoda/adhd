// Issue #139: モンスター図鑑・コレクションアイテムのかなデータ層
// src/lib/monsterKanaMerge.ts の純粋関数テスト（CSVパース・検証・TSソースへのマージ）。
// 設計確定版（v3、Issue #139 コメント参照）に基づく契約テスト。

import { describe, it, expect } from "vitest";
import {
  parseKanaCsv,
  validateKanaRecord,
  applyKanaRecordsToSource,
  type KanaRecord,
} from "@/lib/monsterKanaMerge";

function makeRecord(overrides: Partial<KanaRecord> = {}): KanaRecord {
  return {
    source: "monsters_dark_table",
    key: "STUDY",
    name: "テスト",
    nameKana: "てすと",
    description: "せつめい",
    descriptionKana: "せつめいかな",
    ...overrides,
  };
}

describe("parseKanaCsv", () => {
  it("正常なCSVをパースできる", () => {
    const csv =
      "source,key,name,nameKana,description,descriptionKana\n" +
      "monsters_dark_egg,EGG,たまご,たまご,せつめい,せつめいかな\n" +
      "monsters_dark_table,STUDY,ラーン,らーん,べつのせつめい,べつのせつめいかな\n";

    const result = parseKanaCsv(csv);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.records).toEqual([
      {
        source: "monsters_dark_egg",
        key: "EGG",
        name: "たまご",
        nameKana: "たまご",
        description: "せつめい",
        descriptionKana: "せつめいかな",
      },
      {
        source: "monsters_dark_table",
        key: "STUDY",
        name: "ラーン",
        nameKana: "らーん",
        description: "べつのせつめい",
        descriptionKana: "べつのせつめいかな",
      },
    ]);
  });

  it("ダブルクォート内にカンマを含むフィールドが正しく1フィールドとして扱われる", () => {
    const csv =
      "source,key,name,nameKana,description,descriptionKana\n" +
      'monsters_dark_table,STUDY,ラーン,らーん,"知識、探求、そして忍耐。",ちしきたんきゅうそしてにんたい\n';

    const result = parseKanaCsv(csv);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.records).toHaveLength(1);
    expect(result.records[0].description).toBe("知識、探求、そして忍耐。");
  });

  it('""エスケープ（クオート内のダブルクォート）が正しく1文字の"にデコードされる', () => {
    const csv =
      "source,key,name,nameKana,description,descriptionKana\n" +
      'monsters_dark_table,STUDY,ラーン,らーん,"彼は""すごい""と言った",かれはすごいといった\n';

    const result = parseKanaCsv(csv);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.records[0].description).toBe('彼は"すごい"と言った');
  });

  it("CRLF改行でも正しく行分割される", () => {
    const csv =
      "source,key,name,nameKana,description,descriptionKana\r\n" +
      "monsters_dark_table,STUDY,ラーン,らーん,せつめい,せつめいかな\r\n";

    const result = parseKanaCsv(csv);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.records).toHaveLength(1);
    expect(result.records[0].key).toBe("STUDY");
    // CRLFの\rがフィールド末尾に混入していないこと
    expect(result.records[0].descriptionKana).toBe("せつめいかな");
  });

  it("先頭BOM付きでも正しくパースできる", () => {
    const csv =
      "﻿" +
      "source,key,name,nameKana,description,descriptionKana\n" +
      "monsters_dark_table,STUDY,ラーン,らーん,せつめい,せつめいかな\n";

    const result = parseKanaCsv(csv);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.records).toHaveLength(1);
    expect(result.records[0].source).toBe("monsters_dark_table");
  });

  it("末尾に空行があっても無視される", () => {
    const csv =
      "source,key,name,nameKana,description,descriptionKana\n" +
      "monsters_dark_table,STUDY,ラーン,らーん,せつめい,せつめいかな\n" +
      "\n\n";

    const result = parseKanaCsv(csv);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.records).toHaveLength(1);
  });

  it("ヘッダーのみ（データ0件）はエラーではなく空配列を返す", () => {
    const csv = "source,key,name,nameKana,description,descriptionKana\n";

    const result = parseKanaCsv(csv);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.records).toEqual([]);
  });

  it("不正な閉じクオート（クオートが閉じられていない）はエラーになる（行番号を含む）", () => {
    const csv =
      "source,key,name,nameKana,description,descriptionKana\n" +
      'monsters_dark_table,STUDY,"ラーン,らーん,せつめい,せつめいかな\n';

    const result = parseKanaCsv(csv);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].line).toBe(2);
    expect(typeof result.errors[0].reason).toBe("string");
    expect(result.errors[0].reason.length).toBeGreaterThan(0);
  });

  it("閉じクオート直後に余分な文字がある不正行はエラーになる", () => {
    const csv =
      "source,key,name,nameKana,description,descriptionKana\n" +
      'monsters_dark_table,STUDY,"ラーン"余分,らーん,せつめい,せつめいかな\n';

    const result = parseKanaCsv(csv);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].line).toBe(2);
  });

  it("必須列（name）が空欄の行はエラーになる", () => {
    const csv =
      "source,key,name,nameKana,description,descriptionKana\n" +
      "monsters_dark_table,STUDY,,らーん,せつめい,せつめいかな\n";

    const result = parseKanaCsv(csv);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].line).toBe(2);
  });
});

describe("validateKanaRecord", () => {
  it("name/descriptionが実際の値と完全一致すればokを返す", () => {
    const record = makeRecord({ name: "ラーン", description: "せつめい文" });
    const result = validateKanaRecord(record, "ラーン", "せつめい文");
    expect(result).toEqual({ ok: true });
  });

  it("nameが不一致ならエラーになる", () => {
    const record = makeRecord({ name: "ラーン", description: "せつめい文" });
    const result = validateKanaRecord(record, "べつの名前", "せつめい文");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(typeof result.reason).toBe("string");
    expect(result.reason.length).toBeGreaterThan(0);
  });

  it("descriptionが不一致ならエラーになる", () => {
    const record = makeRecord({ name: "ラーン", description: "せつめい文" });
    const result = validateKanaRecord(record, "ラーン", "べつのせつめい");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(typeof result.reason).toBe("string");
    expect(result.reason.length).toBeGreaterThan(0);
  });
});

describe("applyKanaRecordsToSource", () => {
  it("未適用のシンプルなオブジェクトリテラルに name/description 直後へ kana を挿入する", () => {
    const source =
      'export const MONSTER_TABLE: Record<string, { image: string; name: string; description: string }> = {\n' +
      '  "STUDY": { image: "/x.webp", name: "テスト", description: "せつめい" },\n' +
      "};\n";
    const records = [makeRecord()];

    const result = applyKanaRecordsToSource(source, "monsters_dark_table", records);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.appliedCount).toBe(1);
    expect(result.skippedCount).toBe(0);
    expect(result.sourceText).toContain('name: "テスト", nameKana: "てすと"');
    expect(result.sourceText).toContain('description: "せつめい", descriptionKana: "せつめいかな"');
  });

  it("既にkana適用済みでCSVと完全同一ならno-op（skippedCountに計上、sourceTextは変更なし）", () => {
    const source =
      'export const MONSTER_TABLE = {\n' +
      '  "STUDY": { image: "/x.webp", name: "テスト", nameKana: "てすと", description: "せつめい", descriptionKana: "せつめいかな" },\n' +
      "};\n";
    const records = [makeRecord()];

    const result = applyKanaRecordsToSource(source, "monsters_dark_table", records);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.appliedCount).toBe(0);
    expect(result.skippedCount).toBe(1);
    expect(result.sourceText).toBe(source);
  });

  it("既にkana適用済みでCSVと異なる値ならエラーになる", () => {
    const source =
      'export const MONSTER_TABLE = {\n' +
      '  "STUDY": { image: "/x.webp", name: "テスト", nameKana: "ちがうかな", description: "せつめい", descriptionKana: "せつめいかな" },\n' +
      "};\n";
    const records = [makeRecord({ nameKana: "てすと" })];

    const result = applyKanaRecordsToSource(source, "monsters_dark_table", records);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].key).toBe("STUDY");
  });

  it("nameKanaだけ既に存在しdescriptionKanaが無い（片方だけ）場合はエラーになる", () => {
    const source =
      'export const MONSTER_TABLE = {\n' +
      '  "STUDY": { image: "/x.webp", name: "テスト", nameKana: "てすと", description: "せつめい" },\n' +
      "};\n";
    const records = [makeRecord()];

    const result = applyKanaRecordsToSource(source, "monsters_dark_table", records);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("CSVレコードのkeyに対応するエントリがsourceText中に存在しない場合はエラーになる（no-opにしない）", () => {
    const source =
      'export const MONSTER_TABLE = {\n' +
      '  "STAMINA": { image: "/x.webp", name: "テスト", description: "せつめい" },\n' +
      "};\n";
    const records = [makeRecord({ key: "STUDY" })];

    const result = applyKanaRecordsToSource(source, "monsters_dark_table", records);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].key).toBe("STUDY");
  });

  it("同じname/descriptionを持つ別キーのエントリが複数あってもkeyで正しく一意に特定できる", () => {
    const source =
      'export const MONSTER_TABLE = {\n' +
      '  "STUDY": { image: "/a.webp", name: "同じ名前", description: "同じ説明" },\n' +
      '  "STAMINA": { image: "/b.webp", name: "同じ名前", description: "同じ説明" },\n' +
      "};\n";
    const records = [
      makeRecord({
        key: "STAMINA",
        name: "同じ名前",
        nameKana: "おなじなまえ",
        description: "同じ説明",
        descriptionKana: "おなじせつめい",
      }),
    ];

    const result = applyKanaRecordsToSource(source, "monsters_dark_table", records);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // STAMINA だけが更新され、STUDY は変更されない
    expect(result.sourceText).toContain(
      '"STAMINA": { image: "/b.webp", name: "同じ名前", nameKana: "おなじなまえ", description: "同じ説明", descriptionKana: "おなじせつめい" }',
    );
    expect(result.sourceText).toContain(
      '"STUDY": { image: "/a.webp", name: "同じ名前", description: "同じ説明" }',
    );
  });

  it("対象キーのエントリがsourceText中に複数回出現する場合（異常系）はエラーになる", () => {
    const source =
      'export const MONSTER_TABLE = {\n' +
      '  "STUDY": { image: "/a.webp", name: "テスト", description: "せつめい" },\n' +
      '  "STUDY": { image: "/a.webp", name: "テスト", description: "せつめい" },\n' +
      "};\n";
    const records = [makeRecord()];

    const result = applyKanaRecordsToSource(source, "monsters_dark_table", records);

    expect(result.ok).toBe(false);
  });

  it("複数レコードを一度に渡した場合、全件が正しく適用される", () => {
    const source =
      'export const MONSTER_TABLE = {\n' +
      '  "STUDY": { image: "/a.webp", name: "テスト1", description: "せつめい1" },\n' +
      '  "STAMINA": { image: "/b.webp", name: "テスト2", description: "せつめい2" },\n' +
      "};\n";
    const records = [
      makeRecord({ key: "STUDY", name: "テスト1", nameKana: "てすと1", description: "せつめい1", descriptionKana: "せつめい1かな" }),
      makeRecord({ key: "STAMINA", name: "テスト2", nameKana: "てすと2", description: "せつめい2", descriptionKana: "せつめい2かな" }),
    ];

    const result = applyKanaRecordsToSource(source, "monsters_dark_table", records);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.appliedCount).toBe(2);
    expect(result.sourceText).toContain('name: "テスト1", nameKana: "てすと1"');
    expect(result.sourceText).toContain('name: "テスト2", nameKana: "てすと2"');
  });

  it("説明文にダブルクォート・バックスラッシュを含む場合でもTS文字列リテラルとして正しくエスケープされて挿入される", () => {
    const source =
      'export const MONSTER_TABLE = {\n' +
      '  "STUDY": { image: "/a.webp", name: "テスト", description: "せつめい" },\n' +
      "};\n";
    // 実際の値: かれは"すごい"と\いった （ダブルクォート2つとバックスラッシュ1つを含む）
    const trickyDescriptionKana = 'かれは"すごい"と\\いった';
    const records = [makeRecord({ descriptionKana: trickyDescriptionKana })];

    const result = applyKanaRecordsToSource(source, "monsters_dark_table", records);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // 挿入されたTSソース上では " は \" に、\ は \\ にエスケープされていること
    expect(result.sourceText).toContain(
      `descriptionKana: "かれは\\"すごい\\"と\\\\いった"`,
    );
  });

  // KanaSource は判別型として定義されるため、未知の source 文字列（例: "unknown_source"）を
  // 渡すコードはコンパイル時に型エラーとなる。実行時テストは不要（型チェックで保証される）。

  describe("同一ソース内に同じキー集合を持つ複数のテーブル宣言が存在する場合（実データ構成の回帰テスト）", () => {
    // src/lib/monsters.ts の実データ構成を模した source。
    // MONSTER_TABLE と MONSTER_TABLE_LIGHT の両方が "STUDY" キーを持つ点が重要:
    // 宣言スコープの絞り込みが無いと "STUDY" が2箇所にマッチし、複数マッチエラーになるはずである。
    const dualTableSource =
      'export const MONSTER_TABLE: Record<string, { image: string; name: string; description: string }> = {\n' +
      '  "STUDY": { image: "/monsters/dark/STUDY.webp", name: "ダーク名", description: "ダーク説明" },\n' +
      '  "STAMINA": { image: "/monsters/dark/STAMINA.webp", name: "ダーク体力名", description: "ダーク体力説明" },\n' +
      "};\n" +
      "\n" +
      'export const MONSTER_TABLE_LIGHT: typeof MONSTER_TABLE = {\n' +
      '  "STUDY": { image: "/monsters/light/STUDY.webp", name: "ライト名", description: "ライト説明" },\n' +
      '  "STAMINA": { image: "/monsters/light/STAMINA.webp", name: "ライト体力名", description: "ライト体力説明" },\n' +
      "};\n";

    it("source: monsters_dark_table では MONSTER_TABLE 側の STUDY だけが更新され、MONSTER_TABLE_LIGHT 側の STUDY は変更されない", () => {
      const records = [
        makeRecord({
          source: "monsters_dark_table",
          key: "STUDY",
          name: "ダーク名",
          nameKana: "だーくめい",
          description: "ダーク説明",
          descriptionKana: "だーくせつめい",
        }),
      ];

      const result = applyKanaRecordsToSource(dualTableSource, "monsters_dark_table", records);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.appliedCount).toBe(1);

      // MONSTER_TABLE 側の STUDY はkanaが挿入されている
      expect(result.sourceText).toContain(
        '"STUDY": { image: "/monsters/dark/STUDY.webp", name: "ダーク名", nameKana: "だーくめい", description: "ダーク説明", descriptionKana: "だーくせつめい" }',
      );
      // MONSTER_TABLE_LIGHT 側の STUDY は一切変更されない
      expect(result.sourceText).toContain(
        '"STUDY": { image: "/monsters/light/STUDY.webp", name: "ライト名", description: "ライト説明" },\n  "STAMINA": { image: "/monsters/light/STAMINA.webp"',
      );
    });

    it("source: monsters_light_table では MONSTER_TABLE_LIGHT 側の STUDY だけが更新され、MONSTER_TABLE 側の STUDY は変更されない", () => {
      const records = [
        makeRecord({
          source: "monsters_light_table",
          key: "STUDY",
          name: "ライト名",
          nameKana: "らいとめい",
          description: "ライト説明",
          descriptionKana: "らいとせつめい",
        }),
      ];

      const result = applyKanaRecordsToSource(dualTableSource, "monsters_light_table", records);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.appliedCount).toBe(1);

      // MONSTER_TABLE_LIGHT 側の STUDY はkanaが挿入されている
      expect(result.sourceText).toContain(
        '"STUDY": { image: "/monsters/light/STUDY.webp", name: "ライト名", nameKana: "らいとめい", description: "ライト説明", descriptionKana: "らいとせつめい" }',
      );
      // MONSTER_TABLE 側の STUDY は一切変更されない
      expect(result.sourceText).toContain(
        '"STUDY": { image: "/monsters/dark/STUDY.webp", name: "ダーク名", description: "ダーク説明" },\n  "STAMINA": { image: "/monsters/dark/STAMINA.webp"',
      );
    });

    it("スコープ絞り込みが無ければ複数マッチエラーになるはずであることの裏取り: 宣言名を偽装すると解決不能でエラーになる", () => {
      // 宣言スコープが正しく機能していることを裏取りするため、存在しない宣言名を
      // 対象にした場合は「宣言が見つからない」エラーになることを確認する
      // （= 実装が declarationName に依存したスコープ絞り込みを行っている証拠）。
      const brokenSource = dualTableSource.replace("MONSTER_TABLE_LIGHT", "SOMETHING_ELSE");
      const records = [
        makeRecord({
          source: "monsters_light_table",
          key: "STUDY",
          name: "ライト名",
          nameKana: "らいとめい",
          description: "ライト説明",
          descriptionKana: "らいとせつめい",
        }),
      ];

      const result = applyKanaRecordsToSource(brokenSource, "monsters_light_table", records);

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors[0].reason).toContain("MONSTER_TABLE_LIGHT");
    });
  });
});
