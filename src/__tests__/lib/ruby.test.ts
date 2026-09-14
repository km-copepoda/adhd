import { describe, it, expect } from "vitest";
import { parseRubyMarkup, stripRubyMarkup } from "@/lib/ruby";

describe("parseRubyMarkup", () => {
  it("マークアップなし文字列はルビなしセグメント1個になる", () => {
    const result = parseRubyMarkup("こんにちは");
    expect(result).toEqual([{ text: "こんにちは" }]);
  });

  it("マークアップのみの文字列は base/ruby を持つセグメント1個になる", () => {
    const result = parseRubyMarkup("{漢字:かんじ}");
    expect(result).toEqual([{ text: "漢字", ruby: "かんじ" }]);
  });

  it("先頭にマークアップがある場合、正しく分割される", () => {
    const result = parseRubyMarkup("{漢字:かんじ}を書く");
    expect(result).toEqual([
      { text: "漢字", ruby: "かんじ" },
      { text: "を書く" },
    ]);
  });

  it("末尾にマークアップがある場合、正しく分割される", () => {
    const result = parseRubyMarkup("書くのは{漢字:かんじ}");
    expect(result).toEqual([
      { text: "書くのは" },
      { text: "漢字", ruby: "かんじ" },
    ]);
  });

  it("中間にマークアップがある場合、正しく分割される", () => {
    const result = parseRubyMarkup("これは{漢字:かんじ}です");
    expect(result).toEqual([
      { text: "これは" },
      { text: "漢字", ruby: "かんじ" },
      { text: "です" },
    ]);
  });

  it("連続する複数マークアップが別々のセグメントに分かれる", () => {
    const result = parseRubyMarkup("{今:きょ}{日:う}");
    expect(result).toEqual([
      { text: "今", ruby: "きょ" },
      { text: "日", ruby: "う" },
    ]);
  });

  it("閉じ括弧のない不正マークアップは例外を投げずリテラルとして残る", () => {
    expect(() => parseRubyMarkup("{漢字:かんじ")).not.toThrow();
    const result = parseRubyMarkup("{漢字:かんじ");
    const joined = result.map((s) => s.text).join("");
    expect(joined).toBe("{漢字:かんじ");
    expect(result.some((s) => s.ruby)).toBe(false);
  });

  it("コロンのない不正マークアップは例外を投げずリテラルとして残る", () => {
    expect(() => parseRubyMarkup("{漢字}")).not.toThrow();
    const result = parseRubyMarkup("{漢字}");
    const joined = result.map((s) => s.text).join("");
    expect(joined).toBe("{漢字}");
    expect(result.some((s) => s.ruby)).toBe(false);
  });

  it("ルビ部が空の不正マークアップは例外を投げずリテラルとして残る", () => {
    expect(() => parseRubyMarkup("{漢字:}")).not.toThrow();
    const result = parseRubyMarkup("{漢字:}");
    const joined = result.map((s) => s.text).join("");
    expect(joined).toBe("{漢字:}");
    expect(result.some((s) => s.ruby)).toBe(false);
  });

  it("空文字列は例外を投げず、テキストを結合すると空文字列になる", () => {
    expect(() => parseRubyMarkup("")).not.toThrow();
    const result = parseRubyMarkup("");
    expect(result.map((s) => s.text).join("")).toBe("");
  });

  it("同じ文字列を2回連続でパースしても結果が同じ（lastIndex持ち越しバグの回帰テスト）", () => {
    const input = "{今:きょ}{日:う}はいい{天気:てんき}だ";
    const first = parseRubyMarkup(input);
    const second = parseRubyMarkup(input);
    expect(second).toEqual(first);
  });
});

describe("stripRubyMarkup", () => {
  it("マークアップなし文字列は入力そのままを返す", () => {
    expect(stripRubyMarkup("こんにちは")).toBe("こんにちは");
  });

  it("マークアップを取り除いた素テキストを返す", () => {
    expect(stripRubyMarkup("これは{漢字:かんじ}です")).toBe("これは漢字です");
  });

  it("連続する複数マークアップを取り除ける", () => {
    expect(stripRubyMarkup("{今:きょ}{日:う}はいい{天気:てんき}だ")).toBe("今日はいい天気だ");
  });

  it("空文字列は空文字列を返し、例外を投げない", () => {
    expect(() => stripRubyMarkup("")).not.toThrow();
    expect(stripRubyMarkup("")).toBe("");
  });

  it("同じ文字列を2回連続で呼んでも結果が同じ（lastIndex持ち越しバグの回帰テスト）", () => {
    const input = "{今:きょ}{日:う}はいい{天気:てんき}だ";
    expect(stripRubyMarkup(input)).toBe(stripRubyMarkup(input));
  });
});
