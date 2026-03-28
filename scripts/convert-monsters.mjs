/**
 * docs/キャラクター/man/*.png → public/monsters/*.webp (256px)
 * ファイル名 "勉体_アーマード.png" → "STUDY_STAMINA_アーマード.webp"
 */
import sharp from "sharp";
import { readdir, mkdir } from "fs/promises";
import { join, basename } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, "../docs/キャラクター/man");
const DST = join(__dirname, "../public/monsters");

const KANJI_MAP = { "勉": "STUDY", "体": "STAMINA", "生": "LIFE" };

function toPathKey(prefix) {
  // "勉体生" → "STUDY_STAMINA_LIFE"
  return [...prefix].map(c => KANJI_MAP[c]).filter(Boolean).join("_");
}

async function main() {
  await mkdir(DST, { recursive: true });
  const files = await readdir(SRC);
  const pngs = files.filter(f => f.endsWith(".png"));

  const mapping = [];

  for (const file of pngs) {
    // "勉体_アーマード.png" → prefix="勉体", name="アーマード"
    const base = basename(file, ".png");
    const [prefix, ...rest] = base.split("_");
    const charName = rest.join("_");
    const pathKey = toPathKey(prefix);
    const outName = pathKey ? `${pathKey}_${charName}.webp` : `${charName}.webp`;

    await sharp(join(SRC, file))
      .resize(256, 256, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality: 85 })
      .toFile(join(DST, outName));

    mapping.push({ pathKey, charName, file: `/monsters/${outName}` });
    console.log(`${file} → ${outName}`);
  }

  // マッピング確認用に出力
  console.log("\n--- MONSTER_TABLE mapping ---");
  mapping.sort((a, b) => a.pathKey.localeCompare(b.pathKey));
  for (const m of mapping) {
    console.log(`  "${m.pathKey}": { name: "${m.charName}", image: "${m.file}" },`);
  }
}

main().catch(console.error);
