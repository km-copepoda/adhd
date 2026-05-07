import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const LP_PATH = resolve(__dirname, "../../app/page.tsx");
const lpSource = readFileSync(LP_PATH, "utf-8");

const phoneLabelMatches = lpSource.match(/className=\{styles\.phoneLabel\}>([^<]+)</g) ?? [];

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
];

describe("LP APP SCREENS", () => {
  it("11個のスクリーンラベルを持つ（既存4 + 新規7）", () => {
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
    const phoneWrapCount = (lpSource.match(/styles\.phoneWrap/g) ?? []).length;
    expect(phoneWrapCount).toBeGreaterThanOrEqual(EXPECTED_SCREEN_LABELS.length);
  });
});
