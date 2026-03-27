// docs/キャラクター/woman/*.png → public/monsters/light/*.webp 変換スクリプト
// 命名規則: 勉=STUDY 体=STAMINA 生=LIFE、区切りは _ または ：（全角コロン）
import sharp from "sharp";
import { readdirSync } from "fs";
import { join, basename } from "path";

const CHAR_MAP = { "勉": "STUDY", "体": "STAMINA", "生": "LIFE" };

function parseFileName(filename) {
  // "勉体生_幸運の青い鳥.png" or "体体：ブレイブレオ.png"
  // 区切り文字: _ または ：（全角コロン U+FF1A）
  const base = basename(filename, ".png");
  const sepIdx = base.search(/[_：]/);
  if (sepIdx === -1) return null; // スキップ（説明テキストなど）

  const pathPart = base.slice(0, sepIdx);
  const namePart = base.slice(sepIdx + 1);

  const keys = [...pathPart].map(c => CHAR_MAP[c]).filter(Boolean);
  if (keys.length === 0) return null;

  const key = keys.join("_");
  return { key, name: namePart, outFile: `${key}_${namePart}.webp` };
}

const srcDir = "docs/キャラクター/woman";
const outDir = "public/monsters/light";

const files = readdirSync(srcDir).filter(f => f.endsWith(".png"));
const results = [];

for (const file of files) {
  const parsed = parseFileName(file);
  if (!parsed) {
    console.log(`SKIP: ${file}`);
    continue;
  }
  const src = join(srcDir, file);
  const out = join(outDir, parsed.outFile);
  await sharp(src).webp({ quality: 85 }).toFile(out);
  console.log(`OK: ${file} → ${parsed.outFile} (key=${parsed.key}, name=${parsed.name})`);
  results.push(parsed);
}

console.log(`\n変換完了: ${results.length}体`);

// MONSTER_TABLE_LIGHT 用のエントリを出力
console.log("\n--- MONSTER_TABLE_LIGHT entries (for constants.ts) ---");
results.sort((a, b) => a.key.localeCompare(b.key));
for (const r of results) {
  console.log(`  "${r.key}": { image: "/monsters/light/${r.outFile}", name: "${r.name}" },`);
}
