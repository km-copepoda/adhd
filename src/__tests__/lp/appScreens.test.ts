import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const LP_PATH = resolve(__dirname, "../../components/lp/ScreensSection.tsx");
const lpSource = readFileSync(LP_PATH, "utf-8");

const phoneLabelMatches = lpSource.match(/className=\{s\.phoneLabel\}>([^<]+)</g) ?? [];

const EXPECTED_SCREEN_LABELS = [
  "⚔ 子ども — 今日のクエスト",
  "👨‍👩‍👧 親 — 承認センター",
  "🏅 子ども — 実績バッジ",
  "🐉 子ども — モンスター育成",
  "📖 子ども — 図鑑",
  "📣 子ども — ひろば掲示板",
  "📋 親 — タスク管理",
  "🔥 子ども — ストリーク履歴",
  "👨‍👩‍👧‍👦 親 — メンバー管理",
  "🌟 進化カットイン",
  "🔐 ログイン画面",
  "💎 子ども — 宝箱",
  "📦 子ども — コレクション図鑑",
];

describe("LP APP SCREENS", () => {
  it("13個のスクリーンラベルを持つ", () => {
    expect(phoneLabelMatches).toHaveLength(EXPECTED_SCREEN_LABELS.length);
  });

  for (const label of EXPECTED_SCREEN_LABELS) {
    it(`「${label}」を含む`, () => {
      expect(lpSource).toContain(label);
    });
  }

  it("新規追加のスクリーン7個がそれぞれ phoneWrap 構造で実装されている", () => {
    // 新規ラベルとそれに対応する phoneWrap が存在することを軽く担保
    // （phoneLabel の総数 11 とラベル個別存在で十分だが、構造の取り違えを検出する保険）
    const phoneWrapCount = (lpSource.match(/s\.phoneWrap/g) ?? []).length;
    expect(phoneWrapCount).toBeGreaterThanOrEqual(EXPECTED_SCREEN_LABELS.length);
  });
});

describe("ScreensSection variant split（ハイライト vs フル）", () => {
  it("HIGHLIGHT_KEYS 定義に 3 つのキーが含まれる（child-quest, parent-approve, evolution-cutscene）", () => {
    expect(lpSource).toContain("HIGHLIGHT_KEYS");
    expect(lpSource).toMatch(/"child-quest"/);
    expect(lpSource).toMatch(/"parent-approve"/);
    expect(lpSource).toMatch(/"evolution-cutscene"/);
  });

  it("variant プロップを受け取り、'highlight' と 'full' の 2 モードを持つ", () => {
    expect(lpSource).toMatch(/variant\s*[?:]/);
    expect(lpSource).toMatch(/"highlight"/);
    expect(lpSource).toMatch(/"full"/);
  });

  it("show() ヘルパで各 phoneWrap を条件描画している（全 13 個が個別条件でラップされる）", () => {
    // 各 phone ブロックは `show("some-key") && (...)` の形でラップされる
    const showMatches = (lpSource.match(/show\("[a-z-]+"\)/g) ?? []);
    expect(showMatches.length).toBe(EXPECTED_SCREEN_LABELS.length);
  });
});

describe("ScreensSection の LP 配置（ハイライト＋フル）", () => {
  const pageSource = readFileSync(
    resolve(__dirname, "../../app/page.tsx"),
    "utf-8",
  );

  it("page.tsx で ScreensSection を 2 回配置している", () => {
    const occurrences = (pageSource.match(/<ScreensSection/g) ?? []).length;
    expect(occurrences).toBe(2);
  });

  it("variant='highlight' は HowItWorks 直後（Features より前）、variant='full' は Features より後", () => {
    const idxFeatures = pageSource.indexOf("<FeaturesSection");
    const idxHighlight = pageSource.search(/<ScreensSection[^>]*variant=["']highlight["']/);
    const idxFull = pageSource.search(/<ScreensSection[^>]*variant=["']full["']/);
    expect(idxHighlight).toBeGreaterThan(0);
    expect(idxFull).toBeGreaterThan(0);
    expect(idxHighlight).toBeLessThan(idxFeatures);
    expect(idxFull).toBeGreaterThan(idxFeatures);
  });
});
