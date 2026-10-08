/**
 * モンスターテーマセットの元画像(PNG)を webp(256px / q85)に変換して public/monsters/<theme>/ へ配置する。
 *
 * 使い方:
 *   node .claude/skills/theme-set-import/scripts/convert-theme-images.mjs --theme yokai --src "docs/キャラクター/妖怪セット" --dry-run
 *   node .claude/skills/theme-set-import/scripts/convert-theme-images.mjs --theme yokai --src "docs/キャラクター/妖怪セット"
 *
 * 元ファイル名の規則（仏像セットと同じ）:
 *   "勉体生_なまえ.png" → "STUDY_STAMINA_LIFE_なまえ.webp"   （勉=STUDY 体=STAMINA 生=LIFE。区切りは _ か ：）
 *   "勉_なまえ.png"     → "STUDY_なまえ.webp"
 *   卵: 接頭辞なしで「たまご」を含むファイル → "egg.webp"
 *
 * 変換対象外（黙って捨てず、必ず一覧で報告する）:
 *   - サブフォルダ（ドットver / ドット化するやつ など）
 *   - "不要_" で始まるファイル
 *   - パスが決まらないファイル（名前だけのファイル等）→ 事前リネームが必要
 *
 * 39体(Stage1×3 + Stage2×9 + Stage3×27) + 卵が揃っていない/重複がある場合は、変換せずに
 * 問題を報告して終了コード1で終わる（--allow-partial で部分変換を許可）。
 * sharp はプロジェクトの node_modules から解決される。
 */
import sharp from "sharp";
import { readdir, mkdir } from "fs/promises";
import { join, basename, extname } from "path";

const KANJI_MAP = { 勉: "STUDY", 体: "STAMINA", 生: "LIFE" };
const AXES = ["STUDY", "STAMINA", "LIFE"];
const SIZE = 256;
const QUALITY = 85;

function parseArgs(argv) {
  const args = { dryRun: false, allowPartial: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--theme") args.theme = argv[++i];
    else if (a === "--src") args.src = argv[++i];
    else if (a === "--out") args.out = argv[++i];
    else if (a === "--dry-run") args.dryRun = true;
    else if (a === "--allow-partial") args.allowPartial = true;
  }
  return args;
}

function allKeys() {
  const keys = [];
  let level = AXES.map((a) => [a]);
  for (let stage = 1; stage <= 3; stage++) {
    keys.push(...level.map((p) => p.join("_")));
    level = level.flatMap((p) => AXES.map((a) => [...p, a]));
  }
  return keys;
}

/** ファイル名(拡張子なし)を { kind: "egg" | "monster", key, name } に解釈する。解釈できなければ null。 */
function parseBaseName(base) {
  const sep = base.search(/[_：]/);
  if (sep === -1) {
    return base.includes("たまご") ? { kind: "egg", key: null, name: base } : null;
  }
  const prefix = base.slice(0, sep);
  const name = base.slice(sep + 1);
  const chars = [...prefix];
  if (chars.length < 1 || chars.length > 3 || !chars.every((c) => c in KANJI_MAP) || !name) return null;
  return { kind: "monster", key: chars.map((c) => KANJI_MAP[c]).join("_"), name };
}

async function main() {
  const { theme, src, out, dryRun, allowPartial } = parseArgs(process.argv.slice(2));
  if (!theme || !src) {
    console.error("usage: --theme <id> --src <dir> [--out <dir>] [--dry-run] [--allow-partial]");
    process.exit(2);
  }
  const dst = out ?? join("public/monsters", theme);

  const entries = await readdir(src, { withFileTypes: true });
  const skippedDirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
  const files = entries.filter((e) => e.isFile() && extname(e.name).toLowerCase() === ".png").map((e) => e.name);

  const skippedUnused = [];
  const unrecognized = [];
  const byKey = new Map();
  let egg = null;
  const duplicates = [];

  for (const file of files) {
    const base = basename(file, extname(file));
    if (base.startsWith("不要_")) {
      skippedUnused.push(file);
      continue;
    }
    const parsed = parseBaseName(base);
    if (!parsed) {
      unrecognized.push(file);
    } else if (parsed.kind === "egg") {
      if (egg) duplicates.push(`卵: ${egg.file} / ${file}`);
      else egg = { file, out: "egg.webp" };
    } else {
      const existing = byKey.get(parsed.key);
      if (existing) duplicates.push(`${parsed.key}: ${existing.file} / ${file}`);
      else byKey.set(parsed.key, { file, out: `${parsed.key}_${parsed.name}.webp` });
    }
  }

  const missing = allKeys().filter((k) => !byKey.has(k));

  console.log(`テーマ: ${theme}  元: ${src}  出力: ${dst}${dryRun ? "  (dry-run)" : ""}`);
  console.log(`変換対象: モンスター ${byKey.size}/39体, 卵 ${egg ? "あり" : "なし"}`);
  if (skippedDirs.length) console.log(`\n[対象外] サブフォルダ:\n  ${skippedDirs.join("\n  ")}`);
  if (skippedUnused.length) console.log(`\n[対象外] 不要_ 接頭辞:\n  ${skippedUnused.join("\n  ")}`);
  if (unrecognized.length) console.log(`\n[要リネーム] パスが決まらないファイル（勉体生_名前.png 形式に）:\n  ${unrecognized.join("\n  ")}`);
  if (duplicates.length) console.log(`\n[重複] 同じパスに複数ファイル:\n  ${duplicates.join("\n  ")}`);
  if (missing.length) console.log(`\n[不足] 画像が無いパス(${missing.length}):\n  ${missing.join("\n  ")}`);
  if (!egg) console.log("\n[不足] 卵画像（接頭辞なしで「たまご」を含む名前）が見つかりません");

  const problems = unrecognized.length + duplicates.length + missing.length + (egg ? 0 : 1);
  if (problems > 0 && !allowPartial) {
    console.error("\n問題があるため変換を中止しました（部分変換したい場合は --allow-partial）。");
    process.exit(1);
  }
  if (dryRun) return;

  await mkdir(dst, { recursive: true });
  const jobs = [...byKey.values(), ...(egg ? [egg] : [])];
  for (const job of jobs) {
    await sharp(join(src, job.file))
      .resize(SIZE, SIZE, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality: QUALITY })
      .toFile(join(dst, job.out));
    console.log(`OK: ${job.file} → ${job.out}`);
  }
  console.log(`\n変換完了: ${jobs.length}ファイル → ${dst}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
