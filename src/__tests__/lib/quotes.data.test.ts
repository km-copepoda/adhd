import { describe, it, expect } from "vitest";
import { QUOTES } from "@/lib/quotes.data";
import { parseRubyMarkup } from "@/lib/ruby";

describe("QUOTES データ整合性", () => {
  it("176件の格言が定義されている", () => {
    expect(QUOTES.length).toBe(176);
  });

  it("全てのidが重複していない", () => {
    const ids = QUOTES.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("全てのtext/author/idが非空文字列である", () => {
    for (const q of QUOTES) {
      expect(q.id.length).toBeGreaterThan(0);
      expect(q.text.length).toBeGreaterThan(0);
      expect(q.author.length).toBeGreaterThan(0);
    }
  });

  it("全てのtextとauthorがparseRubyMarkupを通り、マークアップ崩れ（{}の残存）がない", () => {
    for (const q of QUOTES) {
      const textSegments = parseRubyMarkup(q.text);
      const authorSegments = parseRubyMarkup(q.author);
      const strippedText = textSegments.map((s) => s.text).join("");
      const strippedAuthor = authorSegments.map((s) => s.text).join("");
      expect(strippedText).not.toMatch(/[{}]/);
      expect(strippedAuthor).not.toMatch(/[{}]/);
    }
  });
});
