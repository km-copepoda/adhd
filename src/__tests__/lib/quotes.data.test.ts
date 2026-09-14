import { describe, it, expect } from "vitest";
import { QUOTES } from "@/lib/quotes.data";

// ひらがな・カタカナ・長音記号・句読点・記号・数字・ラテン文字以外（＝漢字）が
// kana列に残っていないことをチェックするための簡易パターン
const KANJI_PATTERN = /[一-鿿]/;

describe("QUOTES データ整合性", () => {
  it("176件の格言が定義されている", () => {
    expect(QUOTES.length).toBe(176);
  });

  it("全てのidが重複していない", () => {
    const ids = QUOTES.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("全てのtext/textKana/author/authorKana/idが非空文字列である", () => {
    for (const q of QUOTES) {
      expect(q.id.length).toBeGreaterThan(0);
      expect(q.text.length).toBeGreaterThan(0);
      expect(q.textKana.length).toBeGreaterThan(0);
      expect(q.author.length).toBeGreaterThan(0);
      expect(q.authorKana.length).toBeGreaterThan(0);
    }
  });

  it("textKana/authorKanaに漢字が残っていない", () => {
    for (const q of QUOTES) {
      expect(q.textKana).not.toMatch(KANJI_PATTERN);
      expect(q.authorKana).not.toMatch(KANJI_PATTERN);
    }
  });
});
