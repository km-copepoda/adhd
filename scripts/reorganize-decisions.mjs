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
 *   value = { supersededBy: title | title[] of superseding entry / entries,
 *             kind: "full"|"partial",
 *             note: 短い日本語補足 }
 *   supersededBy can be an array when multiple later decisions each reverse
 *   different clauses of the original entry.
 */
const SUPERSEDED = {
  "2026-03-12: 仮タスク却下時のXP没収": {
    supersededBy: "2026-03-12: XP付与タイミングを報告時→承認時に変更",
    kind: "full",
    note: "XP 付与を承認時に変更したため、却下時に減点すべき XP がそもそも存在しなくなった（同日中に前提が消失）。",
  },
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
    supersededBy: [
      "2026-05-31: TreasureTrigger.AUTO を PROXY にリネーム（2026-05-30 の「PROXY 禁止」を打ち消し）",
      "2026-05-31: 宝箱ハズレ枠を「コレクションアイテム」に置き換え（季節制 80種）",
    ],
    kind: "partial",
    note: "「trigger=PROXY を新設しない」ルールは 2026-05-31 で撤回。child-view のコレクションタブも同日中に「図鑑+実績」の 2 タブ→アイテム含む 3 タブに拡張。機能本体は現行。",
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
    supersededBy: [
      "2026-05-30: 親代理 report-approve でも宝箱を生成する（即 UNLOCKED / AUTO trigger）",
      "2026-05-31: auto-approve cron は AUTO 宝箱を生成しない（2026-05-28 を部分撤回）",
    ],
    kind: "partial",
    note: "「親代理経路では宝箱を生成しない」ルールは 2026-05-30 で撤回、「自動承認 cron が (childId, date) 集約で AUTO 宝箱を生成する」ルールは 2026-05-31 で撤回。制度本体は現行。",
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
  "2026-06-25: 親側のチェックイン履歴を「記録 > 過去」に追加（専用 API）": {
    supersededBy: "2026-07-02: 親側チェックインカレンダーを HeatmapGrid に統合（ParentCheckinCalendar 廃止）",
    kind: "partial",
    note: "独立コンポーネント `ParentCheckinCalendar` は 2026-07-02 で廃止され HeatmapGrid にオーバーレイ統合。API / `buildMonthGrid` は現行。",
  },
  "2026-04-26: あつまり機能（場所×合言葉グループ＋自動掲示板）の導入": {
    supersededBy: "2026-05-09: ひろば なかま一覧の表示識別子を `monsterName` + `speciesName` の2軸に再構成し API から `name` を除去",
    kind: "partial",
    note: "参加メンバー一覧の `name`（本名）フォールバックは 2026-05-09 で撤回（プライバシー）。あつまり機能本体は現行。",
  },
  "2026-05-09: 「今日やる宣言ボーナス」の導入（放置タスク回避向け）": {
    supersededBy: "2026-05-09 (改): 「今日やる宣言」の放置判定を「直近 N 出現の連続非 APPROVED 数」に変更",
    kind: "partial",
    note: "カレンダー日数ベース (`IDLE_DAYS_THRESHOLD`) の放置判定は同日中の (改) で「直近 N 出現の連続非 APPROVED 数」に置き換え。宣言ボーナス制度本体は現行。",
  },
  "2026-08-06: マネタイズ Phase 1-3 — 子アカウント (FREE 1人) とごほうび (FREE 5個/子) を enforce": {
    supersededBy: "2026-08-06: 子アカウント上限の enforce を正しい経路 (/api/family/members) に移動し、未使用の auth 経路を削除",
    kind: "partial",
    note: "`/api/auth/child-join` の enforcement は 2026-08-06 に `/api/family/members` へ移動、旧 auth 経路は削除。ごほうび上限などその他の条項は現行。",
  },
  "2026-03-25: パラメータ連動の進化パス分岐（確率的選択）": {
    supersededBy: "2026-03-25: Side（DARK/LIGHT）をキャラクタービジュアルセットに再活用",
    kind: "partial",
    note: "「`Side` を廃止し `evolutionPath` に一本化」条項は同日中に撤回。`Side` フィールドはビジュアルセット選択用として再活用された。パラメータ連動の分岐ロジック本体は現行。",
  },
  "2026-03-25: 転生システムとコレクション機能の導入": {
    supersededBy: "2026-04-04: 転生を手動化＋卵選択ボーナス",
    kind: "partial",
    note: "「閾値到達で自動的に卵にリセット」フローは 2026-04-04 で撤回。以降は `rebirthPending` フラグ + ユーザ操作による転生に変更。コレクション機能本体は現行。",
  },
  "2026-03-29: 写真オプショナル化とフラットXP制への移行": {
    supersededBy: [
      "2026-03-29: 報告期限をファミリー単位から子供単位に変更",
      "2026-03-29: difficulty フィールドの完全廃止",
    ],
    kind: "partial",
    note: "`Family.reportDeadlineTime` 導入条項は同日中に撤回され `User.reportDeadlineTime` へ移動。`difficulty` フィールドの UI 表示残存条項も同日中に撤回され完全削除。写真オプショナル化・フラット XP 制本体は現行。",
  },
  "2026-03-13: ストリーク機能の単一レコード方式": {
    supersededBy: "2026-03-17: 一日休み券（restPassUsedAt）廃止",
    kind: "partial",
    note: "`Streak.restPassUsedAt` カラム + 関連 API は 2026-03-17 で削除。ストリーク単一レコード方式本体は現行。",
  },
  "2026-03-17: Web Push 通知（二段構え方式）": {
    supersededBy: "2026-03-18: 親→子 プッシュ通知（手動リマインド）",
    kind: "partial",
    note: "「`PushSubscriber` を親レイアウトのみに追加」条項は 2026-03-18 で拡張、CHILD にも購読を許可し子レイアウトにも設置。二段構え方式本体は現行。",
  },
  "2026-05-30: 子フッター再設計 — コレクションは「図鑑+実績」で先行実装": {
    supersededBy: "2026-05-31: 宝箱ハズレ枠を「コレクションアイテム」に置き換え（季節制 80種）",
    kind: "partial",
    note: "「図鑑+実績」の 2 タブ構成は 2026-05-31 のコレクションアイテム導入で 3 タブ（アイテム追加）に拡張。フッター再設計方針本体は現行。",
  },
  "2026-05-31: 宝箱ハズレ枠を「コレクションアイテム」に置き換え（季節制 80種）": {
    supersededBy: "2026-07-22: 月限定コレクションアイテム 60 種を追加（通常80 → 総140）",
    kind: "partial",
    note: "「マスター 80 種 / API が 80 件返す」契約は 2026-07-22 で拡張（月限定 60 種追加、抽選プール・API レスポンス更新）。コレクション機構本体は現行。",
  },
  "2026-06-03: 実績100バッジの全面見直し（序盤を絞り中盤からの達成感を強化）": {
    supersededBy: "2026-06-03: 宝箱・コレクションアイテム・転生卵を実績の対象に追加（100バッジ維持）",
    kind: "partial",
    note: "`quest_750` `streak_50` `login_60` `login_200` などいくつかのバッジは同日中に削除され、宝箱・コレクション・転生卵バッジ 8 件に置き換え。全体方針（100 バッジ維持・序盤絞り）は現行。",
  },
  "2026-05-11: 親画面に「子供モード（child-view）」を導入（親が子供端末を持たない家庭向けの代理操作）": {
    supersededBy: [
      "2026-05-22: 子供モードの「子供セレクター画面」のフッターを親フッター（ParentBottomNav）に統一",
      "2026-06-08: 親モード（child-view）に「代理スキップ」と「進化／孵化カットイン」をスコープ追加",
    ],
    kind: "partial",
    note: "「子供セレクターに ParentBottomNav を出さない」ルールは 2026-05-22 で撤回。「代理スキップは MVP スコープ外」ルールは 2026-06-08 で撤回（`skip-approve` 追加）。child-view 制度本体は現行。",
  },
  "2026-05-26: 親画面の carryOver 放置バッジを「N日間未完了」→「N回未完了」（出現回数ベース）に変更": {
    supersededBy: "2026-07-02: 一時タスクも carryOver=true を選択可能にする",
    kind: "partial",
    note: "`repeatDays` が空の一時タスクで `carryOverMissedCount` が 1 にフォールバックする挙動は 2026-07-02 で「経過日数（inclusive）」に変更。出現回数ベースの本体ロジックは現行。",
  },
  "2026-05-30: 宝箱抽選を「レア度ごと独立抽選」から「排他的単発抽選」に変更": {
    supersededBy: [
      "2026-06-03: 親ごほうび当選確率を引き下げ (COMMON 1/7→1/10 / UNCOMMON 1/14→1/20 / RARE 1/28→1/30)",
      "2026-06-03: RARE 当選確率をさらに引き下げ (1/30 → 1/45)",
      "2026-06-24: 宝箱の天井(pity)システムを復活（10回連続ハズレ→次は強制 HIT）",
    ],
    kind: "partial",
    note: "確率値 (1/7, 1/14, 1/28) と 5 連続ハズレの pity は後日 tune され直した（2026-06-03 で 1/10・1/20・1/45 に、2026-06-24 で pity 復活）。排他的単発抽選アルゴリズム自体は現行。",
  },
  "2026-07-22: 月限定コレクションアイテム 60 種を追加（通常80 → 総140）": {
    supersededBy: "2026-08-06: マネタイズ Phase 1-4 — FREE は季節コレクション 80 種をロック (抽選プールから除外)",
    kind: "partial",
    note: "「全ユーザ 25 種プール」契約は 2026-08-06 で FREE=月限定 5 種のみ、PREMIUM/スタンドアロン=25 種に変更。総 140 種のマスター定義は現行。",
  },
  "2026-05-30: 親代理 report-approve でも宝箱を生成する（即 UNLOCKED / AUTO trigger）": {
    supersededBy: [
      "2026-05-31: TreasureTrigger.AUTO を PROXY にリネーム（2026-05-30 の「PROXY 禁止」を打ち消し）",
      "2026-05-31: 親プール未設定でも宝箱を生成する（2026-05-28 を撤回）",
      "2026-07-02: 親代理経路でも全完了時に ALL_COMPLETE 宝箱を生成する（PROXY と共存）",
    ],
    kind: "partial",
    note: "`AUTO` trigger は 2026-05-31 に `PROXY` へリネーム。「親プール空なら生成しない」ガードは 2026-05-31 で撤回。「1 日に最大 1 件・`treasureId` 単数返却」契約は 2026-07-02 で `PROXY + ALL_COMPLETE` の複数生成 + `treasureIds` 配列返却に拡張。親代理経路での生成という核は現行。",
  },
};

// GitHub-style heading anchor slugifier — regex ported verbatim from
// `github-slugger` (https://github.com/Flet/github-slugger), which is what
// GitHub uses server-side for heading IDs. Do NOT switch to a Unicode
// property allow-list: GitHub actually preserves symbols such as `→`,
// `📊`, `←`, etc. in heading IDs and only strips a specific enumerated
// set of punctuation.
//
//   1. Lowercase
//   2. Strip the enumerated punctuation ranges (ASCII punct, general
//      punctuation, full-width punct, CJK punct, etc.). Everything else
//      — Unicode letters, digits, symbols, arrows, emoji — is preserved.
//   3. Replace whitespace with '-'
//   4. Duplicate slugs get '-1', '-2', ... suffixes (handled by makeSlugger).
const GITHUB_STRIP_RE =
  /[\0-\x1F!-,\.\/:-@\[-\^`\{-~\xA1-\xA7\xA9\xAB\xAC\xAE\xB0\xB1\xB6\xB7\xBB\xBF\xD7\xF7 -⁯⸀-⹿　-〿︰-﹏﹐-﹞＀-！＃-／：-＠［-｀｛-･]+/g;

function githubSlug(text) {
  return text
    .toLowerCase()
    .replace(GITHUB_STRIP_RE, "")
    .replace(/ /g, "-");
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
    for (const t of successors(meta)) {
      if (!byTitle.has(t)) {
        throw new Error(`SUPERSEDED map: supersededBy title not found: "${t}"`);
      }
    }
  }
}

function successors(meta) {
  return Array.isArray(meta.supersededBy) ? meta.supersededBy : [meta.supersededBy];
}

function injectBanners(entries) {
  const byTitle = new Map(entries.map((e) => [e.title, e]));
  for (const e of entries) {
    const meta = SUPERSEDED[e.title];
    if (!meta) continue;
    const label = meta.kind === "full" ? "⚠ SUPERSEDED" : "⚠ PARTIALLY SUPERSEDED";
    const links = successors(meta).map((t) => {
      const target = byTitle.get(t);
      return `[${t}](#${target.slug})`;
    });
    const linkLine = links.length === 1
      ? `> **${label}** — ${links[0]}`
      : [`> **${label}** —`, ...links.map((l) => `> - ${l}`)].join("\n");
    const banner = [linkLine, `>`, `> ${meta.note}`, ``];
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
