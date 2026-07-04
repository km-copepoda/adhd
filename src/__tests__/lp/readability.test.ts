import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  TREASURE_FEATURE,
  CHEER_FEATURE,
  COLLECTION_FEATURE,
  HIROBA_FEATURES,
} from "@/lib/lp";

/**
 * LP の「見やすさ・情報の伝わりやすさ」を担保するテスト。
 * - 機能カードのグルーピング（14枚フラット並びの防止）
 * - ナビリンクの絞り込み
 * - 箇条書きの分量制限と実装用語の混入防止
 */

function read(relPath: string): string {
  return readFileSync(resolve(__dirname, "../../", relPath), "utf-8");
}

describe("LP readability — FeaturesSection", () => {
  const src = read("components/lp/FeaturesSection.tsx");

  it("機能カードが3つのグループ見出しで整理されている", () => {
    expect(src).toContain("育てて、あつめる");
    expect(src).toContain("毎日つづく仕組み");
    expect(src).toContain("親子でつながる");
  });

  it("確率などの細かい数値はカードに載せない（詳細は FAQ に委譲）", () => {
    expect(src).not.toContain("1/10");
    expect(src).not.toContain("1/45");
  });
});

describe("LP readability — ナビゲーション", () => {
  it("ナビのアンカーリンクは5個以下（CTA を除く）", () => {
    const page = read("app/page.tsx");
    const nav = page.slice(page.indexOf("<nav"), page.indexOf("</nav>"));
    const links = (nav.match(/href="#[a-z]+"/g) ?? []).filter(
      (l) => !l.includes("#cta"),
    );
    expect(links.length).toBeLessThanOrEqual(5);
  });
});

describe("LP readability — 箇条書きの分量と用語", () => {
  it("宝箱・エール・コレクションの bullets は4個以下", () => {
    expect(TREASURE_FEATURE.bullets.length).toBeLessThanOrEqual(4);
    expect(CHEER_FEATURE.bullets.length).toBeLessThanOrEqual(4);
    expect(COLLECTION_FEATURE.bullets.length).toBeLessThanOrEqual(4);
  });

  it("ひろば説明カードに実装用語（Supabase 等）を使わない", () => {
    const bodies = HIROBA_FEATURES.map((f) => f.body).join("\n");
    expect(bodies).not.toMatch(/Supabase|Realtime|API/);
  });
});
