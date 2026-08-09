// Usage: node scripts/reorganize-decisions.mjs
// Reorganizes docs/decisions.md:
//   - Splits into entries by top-level "## YYYY-MM-DD: ..." headers
//   - Injects a SUPERSEDED banner into entries whose specification has been
//     replaced by a later entry (map below, curated manually)
//   - Sorts entries chronologically (stable within same day)
//   - Regenerates a Table of Contents at the top with anchor links
//
// This script is idempotent: running it again on its output produces the
// same output (existing SUPERSEDED banners and TOC section are stripped
// before re-emitting).
//
// Manual audit is required to update the SUPERSEDED map below when new
// specification reversals happen.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, "..", "docs", "decisions.md");

/**
 * Map of superseded entries.
 *   key   = full title of the entry that is (partially) superseded
 *           (i.e. the text after "## ")
 *   value = { supersededBy: title of superseding entry, kind: "full"|"partial",
 *             note: 短い日本語補足 }
 */
const SUPERSEDED = {
  "2026-05-02: ひろば「エールを送る」スタンプ機能の導入": {
    supersededBy: "2026-05-07: エール送信を掲示板（BulletinLog）にも記録する（2026-05-02 の禁止条項を撤回）",
    kind: "partial",
    note: "「掲示板への書き込み禁止」条項のみ 2026-05-07 で撤回。機能本体は現行。",
  },
  "2026-05-28: 親が宝箱プール未設定のときは宝箱を生成しない": {
    supersededBy: "2026-05-31: 親プール未設定でも宝箱を生成する（2026-05-28 を撤回）",
    kind: "full",
    note: "コレクション導入により「ハズレ→コレクション」を成立させる必要が出たため撤回。",
  },
  "2026-05-28: 「渡したよ」フロー廃止 + 子の「ごほうび履歴」を実績ページに統合": {
    supersededBy: "2026-05-31: 「渡したよチェック」を親メモとして復活（2026-05-28 撤回）",
    kind: "partial",
    note: "「渡したよ」チェック自体は 2026-05-31 で親メモとして復活。履歴を実績に統合する部分は現行。",
  },
  "2026-05-29: 宝箱抽選を「レア度ごと独立抽選 + プールから均等選択」に変更": {
    supersededBy: "2026-05-30: 宝箱抽選を「レア度ごと独立抽選」から「排他的単発抽選」に変更",
    kind: "full",
    note: "1タスクで複数レア度当選する問題を解消するため 2026-05-30 で排他的抽選に置き換え。",
  },
  "2026-05-30: 親モード（child-view）に「宝箱」「コレクション」を追加 / 親代理で開封も可能": {
    supersededBy: "2026-05-31: TreasureTrigger.AUTO を PROXY にリネーム（2026-05-30 の「PROXY 禁止」を打ち消し）",
    kind: "partial",
    note: "「trigger=PROXY を新設しない」ルールは 2026-05-31 で撤回。機能本体は現行。",
  },
  "2026-06-02: 宝箱の天井(pity)システムを廃止（5回連続ハズレ→強制ピック を撤回）": {
    supersededBy: "2026-06-24: 宝箱の天井(pity)システムを復活（10回連続ハズレ→次は強制 HIT）",
    kind: "full",
    note: "10連続ハズレという長期不運救済のため 2026-06-24 で復活（閾値は 5→10 に緩和）。",
  },
  "2026-06-10: 子レイアウトに Duolingo ライクの常駐ストリークバッジを追加": {
    supersededBy: "2026-06-29: チェックイン成功時にフルカットイン演出を追加 + 左上常駐ストリークバッジを撤去",
    kind: "partial",
    note: "左上の常駐バッジ表示は 2026-06-29 で撤去（カットイン演出に置き換え）。",
  },
  "2026-05-28: ごほうび（宝箱）システムの導入": {
    supersededBy: "2026-05-31: auto-approve cron は AUTO 宝箱を生成しない（2026-05-28 を部分撤回）",
    kind: "partial",
    note: "「自動承認 cron が (childId, date) 集約で AUTO 宝箱を生成する」部分のみ 2026-05-31 で撤回。制度本体は現行。",
  },
  "2026-06-03: 親ごほうび当選確率を引き下げ (COMMON 1/7→1/10 / UNCOMMON 1/14→1/20 / RARE 1/28→1/30)": {
    supersededBy: "2026-06-03: RARE 当選確率をさらに引き下げ (1/30 → 1/45)",
    kind: "partial",
    note: "RARE 当選確率のみ同日中に 1/30→1/45 に再調整。COMMON / UNCOMMON は現行値のまま。",
  },
  "2026-06-24: チェックインカレンダーの導入": {
    supersededBy: "2026-06-25: チェックインカレンダーを子画面で月→週(7日)表示に変更",
    kind: "partial",
    note: "子画面の月間グリッド表示は 2026-06-25 で週(7日)ストリップに置き換え。制度本体は現行。",
  },
  "2026-05-31: コレクションアイテム獲得をひろば通知＋履歴・図鑑に反映": {
    supersededBy: "2026-05-31: コレクション獲得通知をダブり獲得でも飛ばす（同日同 entry の 2026-05-31 を部分撤回）",
    kind: "partial",
    note: "「初獲得 (count===1) のみひろば通知する」ガードは同日中に撤回。ダブり獲得でも通知するようになった。他の内容は現行。",
  },
};

// GitHub-style heading anchor slugifier.
// Rules (matching github.com's markdown renderer):
//   1. Lowercase
//   2. Strip punctuation but preserve Unicode letters/digits/marks, underscores, hyphens, spaces
//      (full-width parens, colons, exclamation marks etc. are removed entirely, NOT converted to '-')
//   3. Replace runs of whitespace with '-'
//   4. Duplicate slugs get '-1', '-2', ... suffixes (handled by the caller's dedup Set).
function githubSlug(text) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}_\- ]/gu, "")
    .replace(/\s+/g, "-");
}

function makeSlugger() {
  const seen = new Map();
  return (title) => {
    const base = githubSlug(title);
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return n === 0 ? base : `${base}-${n}`;
  };
}

function stripTocBlock(content) {
  // Remove any prior generated TOC block so we don't accumulate.
  return content.replace(/\n?<!-- TOC:START -->[\s\S]*?<!-- TOC:END -->\n?/g, "\n");
}

function parse(content) {
  const lines = content.split(/\r?\n/);
  const headerEndIdx = lines.findIndex((l) => /^## /.test(l));
  if (headerEndIdx < 0) throw new Error("No entries found");

  const header = lines.slice(0, headerEndIdx).join("\n");

  const entries = [];
  let cur = null;
  for (let i = headerEndIdx; i < lines.length; i++) {
    const l = lines[i];
    const m = /^## (\d{4}-\d{2}-\d{2})(?:\s*\(改\))?:\s*(.+)$/.exec(l);
    if (m) {
      if (cur) entries.push(cur);
      const full = l.slice(3);
      cur = { date: m[1], title: full, body: [], originalIdx: entries.length };
    } else if (cur) {
      cur.body.push(l);
    }
  }
  if (cur) entries.push(cur);
  return { header, entries };
}

function stripOldBanners(entries) {
  // Strip SUPERSEDED banner blocks from body so we don't accumulate them.
  for (const e of entries) {
    const bodyText = e.body.join("\n");
    const bannerRe = /^\s*> \*\*⚠ (?:PARTIALLY )?SUPERSEDED[\s\S]*?(?:\n\n|$)/;
    e.body = bodyText.replace(bannerRe, "").split("\n");
    while (e.body.length && e.body[0].trim() === "") e.body.shift();
  }
}

function assignSlugs(entries) {
  // Assign each entry a GitHub-style slug based on rendered order.
  // The TOC section header "## 目次" comes first and consumes the base
  // slug "目次"; account for that so subsequent duplicates would be numbered
  // correctly (there are no colliding entries currently, but this keeps the
  // logic robust).
  const slug = makeSlugger();
  slug("目次"); // reserve the TOC heading's slug
  for (const e of entries) {
    e.slug = slug(e.title);
  }
  // Validate: every supersededBy title in the SUPERSEDED map must correspond
  // to an actual entry, otherwise banner links will point nowhere.
  const byTitle = new Map(entries.map((e) => [e.title, e]));
  for (const [src, meta] of Object.entries(SUPERSEDED)) {
    if (!byTitle.has(src)) {
      throw new Error(`SUPERSEDED map: source title not found in decisions.md: "${src}"`);
    }
    if (!byTitle.has(meta.supersededBy)) {
      throw new Error(`SUPERSEDED map: supersededBy title not found: "${meta.supersededBy}"`);
    }
  }
}

function injectBanners(entries) {
  const byTitle = new Map(entries.map((e) => [e.title, e]));
  for (const e of entries) {
    const meta = SUPERSEDED[e.title];
    if (!meta) continue;
    const label = meta.kind === "full" ? "⚠ SUPERSEDED" : "⚠ PARTIALLY SUPERSEDED";
    const target = byTitle.get(meta.supersededBy);
    const anchor = `#${target.slug}`;
    const banner = [
      `> **${label}** — [${meta.supersededBy}](${anchor})`,
      `>`,
      `> ${meta.note}`,
      ``,
    ];
    e.body = [...banner, ...e.body];
  }
}

function sortEntries(entries) {
  // Sort chronologically by date, stable within a date (preserve original order).
  const sorted = entries.slice().sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return a.originalIdx - b.originalIdx;
  });
  return sorted;
}

function buildToc(entries) {
  const lines = [
    "<!-- TOC:START -->",
    "## 目次",
    "",
    "> 自動生成。手で編集しないこと。`scripts/reorganize-decisions.mjs` を再実行して更新。",
    "",
  ];
  for (const e of entries) {
    const meta = SUPERSEDED[e.title];
    const suffix = meta
      ? meta.kind === "full"
        ? " ⚠️ superseded"
        : " ⚠️ partial"
      : "";
    lines.push(`- [${e.title}](#${e.slug})${suffix}`);
  }
  lines.push("", "<!-- TOC:END -->", "");
  return lines.join("\n");
}

function render(header, toc, entries) {
  const parts = [header.trimEnd(), "", toc];
  for (const e of entries) {
    parts.push(`## ${e.title}`);
    // Ensure body starts with a blank line
    const bodyText = e.body.join("\n").replace(/^\n+/, "").replace(/\n+$/, "");
    parts.push("", bodyText, "");
  }
  return parts.join("\n").replace(/\n{3,}/g, "\n\n") + "\n";
}

const rawContent = readFileSync(FILE, "utf8");
const content = stripTocBlock(rawContent);
const { header, entries } = parse(content);
stripOldBanners(entries);
const sorted = sortEntries(entries);
assignSlugs(sorted);
injectBanners(sorted);
const toc = buildToc(sorted);
const out = render(header, toc, sorted);

// Validate: all original entries preserved
if (sorted.length !== entries.length) {
  throw new Error(`Entry count mismatch: ${sorted.length} vs ${entries.length}`);
}

writeFileSync(FILE, out, "utf8");
console.log(`Wrote ${FILE}: ${sorted.length} entries, TOC + ${Object.keys(SUPERSEDED).length} superseded banners`);
