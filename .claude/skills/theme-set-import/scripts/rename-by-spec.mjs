/**
 * 元画像のファイル名（名前だけ）を、仕様書のパス列を使って「勉体生_名前.png」へリネームする。
 *
 * 使い方（既定は dry-run。実際に変えるのは --apply のときだけ）:
 *   node .claude/skills/theme-set-import/scripts/rename-by-spec.mjs \
 *     --spec docs/未実装仕様書/monster-theme-sets.md --theme yokai --src "docs/キャラクター/妖怪セット" \
 *     [--alias 人魂=STUDY --alias 小オニ=STAMINA] [--apply]
 *
 * 仕様書の該当セクション（見出しに「（<theme>）」を含む `## ` 〜 次の `## `）の表を読み、
 * 各行の「名前」列と「モチーフ」列（あれば）を候補として、ファイル名（拡張子なし）と完全一致するものを探す。
 * --spec には仕様書 md のほか、テーマ.txt（カンマ区切り、表ごとに「パス,名前,…」ヘッダ）も渡せる（txt のときは --theme 不要）。
 *   - パス列: S/St/L（→ か _ 区切り）または STUDY/STAMINA/LIFE。勉/体/生 の接頭辞に変換する。
 *   - 仕様書に載っていない表記のファイル（漢字違い・カタカナ違い等）は --alias 名前=パス で補う。
 *     パスは STUDY_STAMINA / S→St / 勉体 のどの書き方でもよい。
 * 完全一致しないファイル、複数行に一致するファイル、仕様書にあるのに画像が無い行は、すべて一覧で報告する。
 * 既に「勉体生_」形式のファイル・卵（接頭辞なしで「たまご」を含む）・サブフォルダ・「不要_」は触らない。
 * リネーム先に既存ファイル（または他の項目の同一リネーム先）があれば、--allow-partial でも一切変更せず中止する。
 * 1件でも曖昧/未一致があれば --apply でもリネームせず終了コード1（--allow-partial で一致分のみ実行）。
 */
import { readFile, readdir, rename } from "fs/promises";
import { join, extname, basename } from "path";

const TOKEN = { S: "勉", St: "体", L: "生", STUDY: "勉", STAMINA: "体", LIFE: "生", 勉: "勉", 体: "体", 生: "生" };

function parseArgs(argv) {
  const a = { aliases: [], apply: false, allowPartial: false };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    if (v === "--spec") a.spec = argv[++i];
    else if (v === "--theme") a.theme = argv[++i];
    else if (v === "--src") a.src = argv[++i];
    else if (v === "--alias") a.aliases.push(argv[++i]);
    else if (v === "--apply") a.apply = true;
    else if (v === "--allow-partial") a.allowPartial = true;
  }
  return a;
}

/** "S→St" / "STUDY_STAMINA" / "勉体" → "勉体"。解釈できなければ null。 */
function toPrefix(pathText) {
  const t = pathText.trim();
  const tokens = /^[勉体生]{1,3}$/.test(t) ? [...t] : t.split(/[→_]/).map((s) => s.trim());
  if (tokens.length < 1 || tokens.length > 3 || !tokens.every((x) => x in TOKEN)) return null;
  return tokens.map((x) => TOKEN[x]).join("");
}

/** テーマ.txt / .csv 形式（カンマ区切り、表ごとに「パス,名前,…」ヘッダ、空行で表が切れる）。 */
function csvSectionLines(text) {
  return text.split(/\r?\n/).map((l) => (l.trim() ? "|" + l.split(",").join("|") + "|" : ""));
}

function extractSection(md, theme) {
  const lines = md.split(/\r?\n/);
  const start = lines.findIndex((l) => l.startsWith("## ") && l.includes(`（${theme}）`));
  if (start === -1) return null;
  let end = lines.findIndex((l, i) => i > start && l.startsWith("## "));
  if (end === -1) end = lines.length;
  return lines.slice(start, end);
}

/** セクションの表から { prefix, names[] } の行を取り出す（卵の表は対象外）。 */
function parseRows(sectionLines) {
  const rows = [];
  let header = null;
  for (const line of sectionLines) {
    if (!line.trim().startsWith("|")) {
      header = null;
      continue;
    }
    const cells = line.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
    if (cells.every((c) => /^-+$/.test(c))) continue;
    if (!header) {
      header = cells;
      continue;
    }
    if (header[0] !== "パス") continue;
    const prefix = toPrefix(cells[0]);
    if (!prefix) continue;
    const names = [cells[1]];
    const motifIdx = header.indexOf("モチーフ");
    if (motifIdx !== -1 && cells[motifIdx]) names.push(cells[motifIdx]);
    rows.push({ prefix, names: [...new Set(names)], label: cells[0] });
  }
  return rows;
}

async function main() {
  const { spec, theme, src, aliases, apply, allowPartial } = parseArgs(process.argv.slice(2));
  if (!spec || !src || (!theme && !/\.(txt|csv)$/i.test(spec))) {
    console.error("usage: --spec <md|txt|csv> --theme <id (mdのとき必須)> --src <dir> [--alias 名前=パス]... [--apply] [--allow-partial]");
    process.exit(2);
  }

  const specText = await readFile(spec, "utf8");
  const isCsv = /\.(txt|csv)$/i.test(spec);
  const section = isCsv ? csvSectionLines(specText) : extractSection(specText, theme);
  if (!section) {
    console.error(`${spec} に「（${theme}）」を含む ## 見出しが見つかりません`);
    process.exit(2);
  }
  const rows = parseRows(section);

  const aliasMap = new Map();
  for (const al of aliases) {
    const [name, path] = al.split("=");
    const prefix = path && toPrefix(path);
    if (!name || !prefix) {
      console.error(`--alias の形式が不正です: ${al}（例: 人魂=STUDY）`);
      process.exit(2);
    }
    aliasMap.set(name, prefix);
  }

  const entries = await readdir(src, { withFileTypes: true });
  const allNames = entries.map((e) => e.name);
  const files = entries.filter((e) => e.isFile() && extname(e.name).toLowerCase() === ".png").map((e) => e.name);

  const plan = [];
  const ambiguous = [];
  const unmatched = [];
  const usedPrefix = new Map();
  const untouched = [];

  for (const file of files) {
    const base = basename(file, extname(file));
    if (base.startsWith("不要_") || /^[勉体生]{1,3}[_：]/.test(base) || (!/[_：]/.test(base) && base.includes("たまご"))) {
      untouched.push(file);
      continue;
    }
    const hits = new Set(rows.filter((r) => r.names.includes(base)).map((r) => r.prefix));
    if (aliasMap.has(base)) hits.add(aliasMap.get(base));
    if (hits.size === 1) {
      const prefix = [...hits][0];
      plan.push({ file, to: `${prefix}_${base}${extname(file)}`, prefix });
      usedPrefix.set(prefix, [...(usedPrefix.get(prefix) ?? []), file]);
    } else if (hits.size > 1) ambiguous.push(`${file} → 候補 ${[...hits].join(" / ")}`);
    else unmatched.push(file);
  }

  const collisions = [...usedPrefix].filter(([, fs]) => fs.length > 1).map(([p, fs]) => `${p}: ${fs.join(" / ")}`);
  const alreadyPrefixed = new Set(untouched.map((f) => f.match(/^([勉体生]{1,3})[_：]/)?.[1]).filter(Boolean));
  const missing = rows.filter((r) => !usedPrefix.has(r.prefix) && !alreadyPrefixed.has(r.prefix));

  // リネーム先の上書き検査（untouched を含む全ファイル名と比較。大文字小文字無視・NFC 正規化）
  const norm = (n) => n.normalize("NFC").toLowerCase();
  const existing = new Map(allNames.map((n) => [norm(n), n]));
  const planned = new Map();
  const overwrites = [];
  for (const p of plan) {
    const key = norm(p.to);
    const hit = existing.get(key);
    if (hit && norm(hit) !== norm(p.file)) overwrites.push(`${p.file} → ${p.to}（既存: ${hit}）`);
    else if (planned.has(key)) overwrites.push(`${p.file} → ${p.to}（${planned.get(key)} と同じリネーム先）`);
    planned.set(key, p.file);
  }

  console.log(`テーマ: ${theme}  仕様書の行: ${rows.length}  ${apply ? "(--apply)" : "(dry-run)"}\n`);
  for (const p of plan) console.log(`${p.file}  →  ${p.to}`);
  if (untouched.length) console.log(`\n[そのまま] 卵/リネーム済み/不要_:\n  ${untouched.join("\n  ")}`);
  if (unmatched.length) console.log(`\n[仕様書と不一致] --alias 名前=パス で補うか、仕様書を直す:\n  ${unmatched.join("\n  ")}`);
  if (ambiguous.length) console.log(`\n[曖昧] 複数の行に一致:\n  ${ambiguous.join("\n  ")}`);
  if (collisions.length) console.log(`\n[衝突] 同じパスに複数ファイル:\n  ${collisions.join("\n  ")}`);
  if (missing.length) console.log(`\n[画像なし] 仕様書にあるが対応ファイルが無い行:\n  ${missing.map((r) => `${r.label} ${r.names.join("/")}`).join("\n  ")}`);

  if (overwrites.length) console.log(`\n[上書き衝突] リネーム先に既存ファイルあり（元ファイル → リネーム先）:\n  ${overwrites.join("\n  ")}`);

  const problems = unmatched.length + ambiguous.length + collisions.length + missing.length + overwrites.length;
  if (overwrites.length) {
    if (apply) console.error("\n上書き衝突があるため一件もリネームしませんでした（--allow-partial でも中止）。");
    process.exit(1);
  }
  if (problems > 0 && !allowPartial) {
    if (apply) console.error("\n問題があるためリネームしませんでした（--allow-partial で一致分のみ実行）。");
    process.exit(problems > 0 ? 1 : 0);
  }
  if (!apply) return;

  for (const p of plan) await rename(join(src, p.file), join(src, p.to));
  console.log(`\nリネーム完了: ${plan.length}件`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
