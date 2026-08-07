import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  TREASURE_FEATURE,
  CHEER_FEATURE,
  COLLECTION_FEATURE,
  HIROBA_FEATURES,
  FAQ_ITEMS,
  TREASURE_FAQ_ITEMS,
  FAQ_PRIMARY_COUNT,
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

describe("LP readability — FAQ の 2 段構成", () => {
  it("FAQ_PRIMARY_COUNT は 4-6 個の範囲", () => {
    expect(FAQ_PRIMARY_COUNT).toBeGreaterThanOrEqual(4);
    expect(FAQ_PRIMARY_COUNT).toBeLessThanOrEqual(6);
  });

  it("FAQ_ITEMS 総数は FAQ_PRIMARY_COUNT より多い（分割の前提）", () => {
    expect(FAQ_ITEMS.length).toBeGreaterThan(FAQ_PRIMARY_COUNT);
  });

  it("2次質問プール（残り FAQ + 宝箱 FAQ）が存在する", () => {
    const secondary = FAQ_ITEMS.length - FAQ_PRIMARY_COUNT + TREASURE_FAQ_ITEMS.length;
    expect(secondary).toBeGreaterThan(0);
  });

  it("FaqSection は主要 FAQ と 'その他' 折りたたみの 2 グループに分割する", () => {
    const src = read("components/lp/FaqSection.tsx");
    expect(src).toContain("FAQ_PRIMARY_COUNT");
    expect(src).toMatch(/その他の質問|もっと質問を見る|さらに詳しく/);
  });
});

describe("LP readability — ScreensSection の配置", () => {
  it("ScreensSection は HowItWorksSection の直後に配置する（アプリ画面の早期訴求）", () => {
    const page = read("app/page.tsx");
    const idxHow = page.indexOf("<HowItWorksSection");
    const idxScreens = page.indexOf("<ScreensSection");
    const idxFeatures = page.indexOf("<FeaturesSection");
    expect(idxHow).toBeGreaterThan(0);
    expect(idxScreens).toBeGreaterThan(0);
    expect(idxFeatures).toBeGreaterThan(0);
    // 順序: HowItWorks → Screens → Features
    expect(idxScreens).toBeGreaterThan(idxHow);
    expect(idxScreens).toBeLessThan(idxFeatures);
  });
});

describe("LP readability — 箇条書きの分量と用語", () => {
  it("宝箱・エール・コレクションの bullets は6個以下", () => {
    expect(TREASURE_FEATURE.bullets.length).toBeLessThanOrEqual(6);
    expect(CHEER_FEATURE.bullets.length).toBeLessThanOrEqual(6);
    expect(COLLECTION_FEATURE.bullets.length).toBeLessThanOrEqual(6);
  });

  it("ひろば説明カードに実装用語（Supabase 等）を使わない", () => {
    const bodies = HIROBA_FEATURES.map((f) => f.body).join("\n");
    expect(bodies).not.toMatch(/Supabase|Realtime|API/);
  });
});
