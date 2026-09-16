/**
 * docs/資料系/モンスター・コレクションかな.csv を読み込み、
 *   - src/lib/monsters.ts        (monsters_dark_egg / monsters_dark_table /
 *                                  monsters_light_egg / monsters_light_table)
 *   - src/lib/monsterThemes/buddha.ts (buddha_egg / buddha_table)
 *   - src/lib/collectionItems.ts (collection)
 * の3ファイルへ nameKana / descriptionKana フィールドを挿入するワンショット生成CLI（Issue #139）。
 *
 * 判定・検証・書き換えロジックは一切持たない。src/lib/monsterKanaMerge.ts の
 * 純粋関数（parseKanaCsv / applyKanaRecordsToSource）を呼び出すだけの薄いI/Oラッパー。
 *
 * 実行方法: npm run gen:monster-kana
 *
 * 安全性:
 *   - 3ファイルすべてが ok: true になるまでファイルへの書き込みは一切行わない
 *     （メモリ上で全出力を生成してから書く）。1件でも不一致・キー欠落があれば
 *     エラー内容を全て表示して process.exit(1) する（部分適用を防ぐ）。
 *   - ただし、これは「全件検証完了前には書き込まない」ことのみを保証するものであり、
 *     3回の writeFileSync 呼び出しそのもののファイルシステムレベルの完全な原子性
 *     （途中でプロセスが落ちた場合に全て未適用に戻ることなど）までは保証しない。
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  parseKanaCsv,
  applyKanaRecordsToSource,
  type KanaRecord,
  type KanaSource,
} from "@/lib/monsterKanaMerge";

const CSV_PATH = path.join(process.cwd(), "docs", "資料系", "モンスター・コレクションかな.csv");
const MONSTERS_PATH = path.join(process.cwd(), "src", "lib", "monsters.ts");
const BUDDHA_PATH = path.join(process.cwd(), "src", "lib", "monsterThemes", "buddha.ts");
const COLLECTION_ITEMS_PATH = path.join(process.cwd(), "src", "lib", "collectionItems.ts");

/** 1ファイルに対して、複数の KanaSource を順番に適用するステップ。 */
type FileTarget = {
  path: string;
  sources: KanaSource[];
};

const FILE_TARGETS: FileTarget[] = [
  {
    path: MONSTERS_PATH,
    sources: ["monsters_dark_egg", "monsters_dark_table", "monsters_light_egg", "monsters_light_table"],
  },
  { path: BUDDHA_PATH, sources: ["buddha_egg", "buddha_table"] },
  { path: COLLECTION_ITEMS_PATH, sources: ["collection"] },
];

function groupBySource(records: readonly KanaRecord[]): Map<KanaSource, KanaRecord[]> {
  const map = new Map<KanaSource, KanaRecord[]>();
  for (const record of records) {
    const source = record.source as KanaSource;
    const list = map.get(source) ?? [];
    list.push(record);
    map.set(source, list);
  }
  return map;
}

function main(): void {
  const csvText = readFileSync(CSV_PATH, "utf-8");
  const parsed = parseKanaCsv(csvText);
  if (!parsed.ok) {
    console.error("CSVのパースに失敗しました:");
    for (const e of parsed.errors) {
      console.error(`  - ${e.line}行目: ${e.reason}`);
    }
    process.exit(1);
  }

  console.log(`処理対象件数（CSV全行）: ${parsed.records.length}`);

  const recordsBySource = groupBySource(parsed.records);

  let totalApplied = 0;
  let totalSkipped = 0;
  const errors: string[] = [];
  const pendingWrites: { path: string; text: string }[] = [];

  for (const target of FILE_TARGETS) {
    let text = readFileSync(target.path, "utf-8");
    let fileChanged = false;

    for (const source of target.sources) {
      const records = recordsBySource.get(source) ?? [];
      if (records.length === 0) {
        errors.push(`${target.path}: source "${source}" に対応するCSV行が0件です`);
        continue;
      }

      const result = applyKanaRecordsToSource(text, source, records);
      if (!result.ok) {
        for (const e of result.errors) {
          errors.push(`${target.path} [${source}] key=${e.key}: ${e.reason}`);
        }
        continue;
      }

      if (result.sourceText !== text) fileChanged = true;
      text = result.sourceText;
      totalApplied += result.appliedCount;
      totalSkipped += result.skippedCount;
    }

    if (fileChanged) pendingWrites.push({ path: target.path, text });
  }

  if (errors.length > 0) {
    console.error("マージに失敗しました。ファイルへの書き込みは行いません:");
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }

  for (const { path: filePath, text } of pendingWrites) {
    writeFileSync(filePath, text, "utf-8");
    console.log(`書き込み完了: ${filePath}`);
  }

  console.log(`挿入件数: ${totalApplied}`);
  console.log(`スキップ件数（既に適用済み）: ${totalSkipped}`);
}

main();
