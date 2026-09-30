/**
 * テーマデータ JSON + public/monsters/<theme>/ の webp 実ファイル名から
 * src/lib/monsterThemes/<theme>.ts（buddha.ts と同型）を生成する。
 *
 * 使い方:
 *   node .claude/skills/theme-set-import/scripts/gen-theme-ts.mjs --theme yokai --data <data.json> [--force]
 *
 * data.json の形（39体 + 卵。5項目すべて必須・空文字不可）:
 *   {
 *     "label": "妖怪", "description": "日本の妖怪モチーフのモンスターセット。",   // レジストリ登録用（このスクリプトでは未使用）
 *     "egg": { "name": "...", "nameKana": "...", "description": "...", "descriptionKana": "..." },
 *     "entries": { "STUDY": { "name": "...", "nameKana": "...", "description": "...", "descriptionKana": "..." }, ... 39キー }
 *   }
 *
 * image パスは JSON に書かせず、実際に存在する webp のファイル名から機械的に決める
 * （buddha.ts の「画像は実ファイル名と完全一致させること」を人手に頼らず守るため）。
 * 既存の <theme>.ts は --force が無い限り上書きしない。
 */
import { readFile, readdir, writeFile, access } from "fs/promises";
import { join } from "path";

const AXES = ["STUDY", "STAMINA", "LIFE"];
const FIELDS = ["name", "nameKana", "description", "descriptionKana"];
const PATH_RE = /^((?:STUDY|STAMINA|LIFE)(?:_(?:STUDY|STAMINA|LIFE))*)_(.+)\.webp$/;

function parseArgs(argv) {
  const args = { force: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--theme") args.theme = argv[++i];
    else if (argv[i] === "--data") args.data = argv[++i];
    else if (argv[i] === "--force") args.force = true;
  }
  return args;
}

function keysByStage() {
  const stages = [];
  let level = AXES.map((a) => [a]);
  for (let s = 1; s <= 3; s++) {
    stages.push(level.map((p) => p.join("_")));
    level = level.flatMap((p) => AXES.map((a) => [...p, a]));
  }
  return stages;
}

const q = (s) => JSON.stringify(s);

async function main() {
  const { theme, data, force } = parseArgs(process.argv.slice(2));
  if (!theme || !data) {
    console.error("usage: --theme <id> --data <json> [--force]");
    process.exit(2);
  }
  const imgDir = join("public/monsters", theme);
  const outFile = join("src/lib/monsterThemes", `${theme}.ts`);
  const json = JSON.parse(await readFile(data, "utf8"));

  const exists = await access(outFile).then(() => true, () => false);
  if (exists && !force) {
    console.error(`${outFile} は既に存在します（上書きするなら --force）。`);
    process.exit(1);
  }

  const errors = [];

  // 画像: キー → ファイル名
  const files = await readdir(imgDir);
  const imageByKey = new Map();
  for (const f of files) {
    const m = f.match(PATH_RE);
    if (m) imageByKey.set(m[1], f);
  }
  if (!files.includes("egg.webp")) errors.push(`${imgDir}/egg.webp がありません`);

  const stages = keysByStage();
  const allKeys = stages.flat();
  const checkEntry = (label, e) => {
    if (!e) return errors.push(`${label}: データがありません`);
    for (const f of FIELDS) if (typeof e[f] !== "string" || e[f].trim() === "") errors.push(`${label}.${f} が空です`);
  };
  checkEntry("egg", json.egg);
  for (const k of allKeys) {
    checkEntry(k, json.entries?.[k]);
    if (!imageByKey.has(k)) errors.push(`${k}: ${imgDir} に対応する webp がありません`);
  }
  for (const k of Object.keys(json.entries ?? {})) if (!allKeys.includes(k)) errors.push(`${k}: 想定外のキーです`);

  if (errors.length) {
    console.error(errors.join("\n"));
    process.exit(1);
  }

  const line = (k, e) =>
    `  ${q(k)}: { image: ${q(`/monsters/${theme}/${imageByKey.get(k)}`)}, name: ${q(e.name)}, nameKana: ${q(e.nameKana)}, ` +
    `description: ${q(e.description)}, descriptionKana: ${q(e.descriptionKana)} },`;

  const egg = json.egg;
  const body = stages
    .map((keys, i) => `  // Stage ${i + 1}: ${keys.length}体\n${keys.map((k) => line(k, json.entries[k])).join("\n")}`)
    .join("\n\n");

  const ts = `// ${theme} テーマのモンスターテーブル。
// src/lib/monsters.ts の MONSTER_TABLE と同型・同キー（39体）。
// 画像は public/monsters/${theme}/ 配下の実ファイル名と完全一致させること。
// （このファイルは .claude/skills/theme-set-import/scripts/gen-theme-ts.mjs で生成）

import type { MonsterEntry, MonsterStage } from "@/lib/monsterEntry";

export const EGG_STAGE: MonsterStage = {
  image: ${q(`/monsters/${theme}/egg.webp`)},
  name: ${q(egg.name)}, nameKana: ${q(egg.nameKana)},
  ptToEvolve: 1,
  description: ${q(egg.description)}, descriptionKana: ${q(egg.descriptionKana)},
};

export const MONSTER_TABLE: Record<string, MonsterEntry> = {
${body}
};
`;
  await writeFile(outFile, ts, "utf8");
  console.log(`生成しました: ${outFile}（${allKeys.length}体 + 卵）`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
