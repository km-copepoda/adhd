/**
 * develop ブランチにアップロードされた月限定アイテム画像 (docs/キャラクター/コレクション/{月}/*.png)
 * を WebP に変換して public/collection-items/monthly/ に配置する。
 * また 夏/アレキサンドライト.png は public/collection-items/summer/ に配置する
 * (summer-11 の改名対応)。
 *
 * ソース画像は develop ブランチのコミット e3e3b74 に含まれる 61 ファイル。
 * ワーキングツリーが develop でない場合は `git show develop:<path>` で読み出す。
 *
 * 実行: node scripts/convert-collection-monthly.mjs
 *
 * 名前の揺れ対応（ソースファイル名 → collectionItems.ts の name）:
 *   鏡餅       → 鏡もち     (m01-01)
 *   ダイアモンド → ダイヤモンド (m04-04)
 *   千歳飴     → 千歳あめ   (m11-03)
 *   ゆず湯     → ゆず湯のゆず (m12-02)
 */
import sharp from "sharp";
import { execSync } from "child_process";
import { mkdirSync, writeFileSync, unlinkSync } from "fs";
import { join, basename, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const TMP = join(ROOT, "tmp_src");
const DST_MONTHLY = join(ROOT, "public/collection-items/monthly");
const DST_SUMMER = join(ROOT, "public/collection-items/summer");

// ソースファイル名 → collectionItems.ts の name への rename マップ（差分のみ）
const RENAME = {
  "鏡餅": "鏡もち",
  "ダイアモンド": "ダイヤモンド",
  "千歳飴": "千歳あめ",
  "ゆず湯": "ゆず湯のゆず",
};

// 月ディレクトリ名 (docs 下) の全リスト
const MONTH_DIRS = [
  "1月", "2月", "3月", "4月", "5月", "6月",
  "7月", "8月", "9月", "10月", "11月", "12月",
];

async function convertOne(srcRelPath, dstDir) {
  const srcBase = basename(srcRelPath, ".png");
  const outName = (RENAME[srcBase] ?? srcBase) + ".webp";
  const dstPath = join(dstDir, outName);
  mkdirSync(dstDir, { recursive: true });

  // git show でソースを一時ファイルに書き出し (develop ブランチから)
  const tmpFile = join(TMP, "current.png");
  const buf = execSync(`git show develop:"${srcRelPath}"`, { maxBuffer: 50 * 1024 * 1024 });
  writeFileSync(tmpFile, buf);

  // 既存 collection-items 画像と同じ規約:
  // - 元の縦横比を保持
  // - 長辺 1536px を上限（既存が 1536 or 1024 で入っているため揃える）
  // - webp quality 85 (convert-monsters.mjs と同じ)
  await sharp(tmpFile)
    .resize(1536, 1536, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 85 })
    .toFile(dstPath);

  unlinkSync(tmpFile);
  return { srcBase, outName, dstPath };
}

async function main() {
  mkdirSync(TMP, { recursive: true });
  mkdirSync(DST_MONTHLY, { recursive: true });
  mkdirSync(DST_SUMMER, { recursive: true });

  const results = [];

  // 月限定アイテム 60 枚: monthly/{MM}/ サブディレクトリに配置
  // (制作元 docs/キャラクター/コレクション/{N}月/ と同じ月別構成)
  for (const monthDir of MONTH_DIRS) {
    const mm = String(parseInt(monthDir, 10)).padStart(2, "0");
    const dstDir = join(DST_MONTHLY, mm);
    const monthPrefix = `docs/キャラクター/コレクション/${monthDir}/`;
    const listOut = execSync(
      `git -c core.quotepath=false ls-tree --name-only develop "${monthPrefix}"`,
      { encoding: "utf8" }
    );
    const files = listOut.split("\n").filter((f) => f.endsWith(".png"));
    for (const f of files) {
      const r = await convertOne(f, dstDir);
      console.log(`[monthly/${mm}] ${basename(f)} → ${r.outName}`);
      results.push({ month: monthDir, ...r });
    }
  }

  // 夏 アレキサンドライト (summer-11 の差し替え)
  const alexPath = "docs/キャラクター/コレクション/夏/アレキサンドライト.png";
  const r = await convertOne(alexPath, DST_SUMMER);
  console.log(`[summer] ${basename(alexPath)} → ${r.outName}`);
  results.push({ month: "夏", ...r });

  console.log(`\nTotal: ${results.length} files converted`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
