import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * LP 全体のトンマナを統一するためのテスト。
 *
 * ルール:
 *  - セクションの副題 (sectionSub) は「1 行・句点なし・60 文字以内」
 *  - 「（想定）」など内部用注記を残さない
 *  - 新セクション TreasureSection は MonstersSection の "MONSTER COLLECTION" と
 *    語が衝突しないように "TREASURE BOX" 系の見出しにする
 */

const SECTIONS_DIR = resolve(__dirname, "../../components/lp");

function read(file: string): string {
  return readFileSync(resolve(SECTIONS_DIR, file), "utf-8");
}

/** sectionSub の <p ... className={`${s.sectionSub} ${s.fadeIn}`}>...</p> 内のテキストを抜き出す。 */
function extractSectionSub(src: string): string[] {
  const re = /sectionSub[^>]*>([\s\S]*?)<\/p>/g;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    // JSX 中の {" "} などを削除
    const stripped = m[1]
      .replace(/<br\s*\/?>/g, "\n")
      .replace(/\{[^}]*\}/g, "")
      .replace(/\s+/g, "")
      .trim();
    out.push(stripped);
  }
  return out;
}

const FILES_WITH_SECTION_SUB = [
  "PainSection.tsx",
  "HowItWorksSection.tsx",
  "FeaturesSection.tsx",
  "MonstersSection.tsx",
  "HirobaSection.tsx",
  "TreasureSection.tsx",
  "HabitSection.tsx",
  "BeforeAfterSection.tsx",
  "ScreensSection.tsx",
  "InstallGuideSection.tsx",
  "VoicesSection.tsx",
  "FaqSection.tsx",
];

describe("LP tone & manner — section sub", () => {
  for (const file of FILES_WITH_SECTION_SUB) {
    const src = read(file);
    const subs = extractSectionSub(src);

    it(`${file}: sectionSub が 1 つ存在する`, () => {
      expect(subs.length).toBeGreaterThanOrEqual(1);
    });

    it(`${file}: sectionSub に句点 "。" を含まない（語尾統一）`, () => {
      for (const s of subs) {
        expect(s, `sub of ${file}`).not.toMatch(/。/);
      }
    });

    it(`${file}: sectionSub に <br> による改行を含まない（1 行に統一）`, () => {
      // 改行が混入してたら extract した文字列に \n が残る
      for (const s of subs) {
        expect(s, `sub of ${file}`).not.toMatch(/\n/);
      }
    });

    it(`${file}: sectionSub は 60 文字以内`, () => {
      for (const s of subs) {
        expect(
          s.length,
          `sub of ${file} (${s})`,
        ).toBeLessThanOrEqual(60);
      }
    });
  }
});

describe("LP tone & manner — VoicesSection", () => {
  const src = read("VoicesSection.tsx");

  it("副題に内部用注記「（想定）」を含まない", () => {
    expect(src).not.toContain("（想定）");
  });
});

describe("LP tone & manner — TreasureSection の見出し", () => {
  const src = read("TreasureSection.tsx");

  it("見出しは 'TREASURE BOX' を含む (MonstersSection の MONSTER COLLECTION と語が衝突しないように)", () => {
    expect(src).toMatch(/TREASURE\s+BOX/);
  });
});

describe("LP tone & manner — CtaSection 本文", () => {
  const src = read("CtaSection.tsx");

  it("CTA 本文に <br /> 改行を含まない（1 文に統一）", () => {
    // <p className={s.ctaDesc}>...</p> の中に <br /> を入れない
    const ctaDescMatch = src.match(/ctaDesc[^>]*>([\s\S]*?)<\/p>/);
    expect(ctaDescMatch).not.toBeNull();
    expect(ctaDescMatch![1]).not.toMatch(/<br\s*\/?>/);
  });
});
