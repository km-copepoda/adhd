/**
 * public/collection-items/{season,monthly}/*.webp から
 * public/collection-items/shadow/{season,monthly}/*.webp を生成する。
 *
 * scripts/gen_shadow.py の JS 版。不透明ピクセルはすべて暗紫色 (25,20,50) に置換し、
 * 透明部分はそのまま維持する。ファイルサイズが元画像の 1/10〜1/30 程度に圧縮できる
 * ため、未取得アイテムの表示に使うと以下のメリットがある:
 *  - コンテンツ漏洩防止 (Network タブや DevTools で本物の絵が見えない)
 *  - 転送量削減 (単色 + アルファなので webp が非常に小さくなる)
 *
 * 実行: node scripts/gen-collection-shadows.mjs
 */
import sharp from "sharp";
import { readdir, mkdir, stat } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SRC_BASE = join(ROOT, "public/collection-items");
const DST_BASE = join(ROOT, "public/collection-items/shadow");

const SHADOW = { r: 25, g: 20, b: 50 };
// spring/summer/fall/winter は直下に webp、monthly は {MM}/ サブディレクトリ配下
const FLAT_SUBDIRS = ["spring", "summer", "fall", "winter"];
const MONTHLY_SUBDIR = "monthly";
const MONTH_DIRS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));

// UI では 48〜64px の小サイズでしか表示しないので、shadow は 256px 上限で十分。
// 元画像 (1024〜1536px) をそのまま単色化すると 60〜130KB になってしまうが、
// 256px なら 3〜10KB / 枚に収まる。
const SHADOW_MAX_DIM = 256;

async function makeShadow(srcPath, dstPath) {
  // 先に小さくリサイズしてから raw ピクセル操作 (メモリ節約 & CPU 高速化)
  const { data, info } = await sharp(srcPath)
    .resize(SHADOW_MAX_DIM, SHADOW_MAX_DIM, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  // 不透明ピクセル (alpha > 0) を SHADOW_COLOR で塗りつぶし
  const out = Buffer.from(data);
  for (let i = 0; i < out.length; i += 4) {
    if (out[i + 3] > 0) {
      out[i] = SHADOW.r;
      out[i + 1] = SHADOW.g;
      out[i + 2] = SHADOW.b;
    }
  }
  await sharp(out, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    // 単色シルエットは品質を下げても違いが目立たない
    .webp({ quality: 70 })
    .toFile(dstPath);
}

async function processDir(sub) {
  const srcDir = join(SRC_BASE, sub);
  const dstDir = join(DST_BASE, sub);
  let entries;
  try {
    entries = await readdir(srcDir);
  } catch {
    console.log(`  (${sub}) no source dir, skip`);
    return 0;
  }
  await mkdir(dstDir, { recursive: true });
  const webps = entries.filter((f) => f.endsWith(".webp"));
  for (const f of webps) {
    const srcPath = join(srcDir, f);
    const dstPath = join(dstDir, f);
    const st = await stat(srcPath);
    await makeShadow(srcPath, dstPath);
    const st2 = await stat(dstPath);
    console.log(
      `  ${sub}/${f}: ${Math.round(st.size / 1024)}KB → ${Math.round(st2.size / 1024)}KB`,
    );
  }
  return webps.length;
}

async function main() {
  let total = 0;
  for (const sub of FLAT_SUBDIRS) {
    console.log(`[${sub}]`);
    total += await processDir(sub);
  }
  // monthly は {MM}/ サブディレクトリごとに処理
  for (const mm of MONTH_DIRS) {
    const rel = `${MONTHLY_SUBDIR}/${mm}`;
    console.log(`[${rel}]`);
    total += await processDir(rel);
  }
  console.log(`\nTotal: ${total} shadow files generated`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
