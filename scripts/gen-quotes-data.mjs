/**
 * docs/資料系/格言_かな.csv → src/lib/quotes.data.ts
 *
 * CSVを編集した後、`node scripts/gen-quotes-data.mjs` で再生成する。
 */
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSV_PATH = join(__dirname, "../docs/資料系/格言_かな.csv");
const OUT_PATH = join(__dirname, "../src/lib/quotes.data.ts");

const csv = readFileSync(CSV_PATH, "utf8");
const lines = csv.split(/\r?\n/).filter((l) => l.length > 0);
const [, ...dataLines] = lines; // ヘッダー（分類,名前,名前_仮名,格言,格言_仮名）を除く

function splitCsvLine(line) {
  const parts = [];
  let start = 0;
  for (let i = 0; i < 4; i++) {
    const idx = line.indexOf(",", start);
    parts.push(line.slice(start, idx));
    start = idx + 1;
  }
  parts.push(line.slice(start));
  return parts;
}

function esc(s) {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

const entries = dataLines.map((line, i) => {
  const [, author, authorKana, text, textKana] = splitCsvLine(line);
  const id = `quote-${String(i + 1).padStart(3, "0")}`;
  return `  { id: "${id}", text: "${esc(text)}", textKana: "${esc(textKana)}", author: "${esc(author)}", authorKana: "${esc(authorKana)}" },`;
});

const output = `/**
 * 日替わり格言データ（元データ: docs/資料系/格言_かな.csv）。
 * このファイルは \`node scripts/gen-quotes-data.mjs\` で自動生成される。手で編集しない。
 *
 * \`text\`/\`author\` は通常表記、\`textKana\`/\`authorKana\` はひらがな・カタカナのみの
 * 読み下し表記（漢字を含まない）。ふりがな表示はインラインルビではなく、
 * \`rubyEnabled\` に応じて表記をまるごと差し替える方式を採る。
 *
 * 純粋データのみを置くファイル（コード構成規約: データ定義区分）。ロジックは含めない。
 */

export type Quote = {
  id: string;
  text: string;
  textKana: string;
  author: string;
  authorKana: string;
};

export const QUOTES: readonly Quote[] = [
${entries.join("\n")}
];
`;

writeFileSync(OUT_PATH, output, "utf8");
console.log(`wrote ${entries.length} entries to ${OUT_PATH}`);
