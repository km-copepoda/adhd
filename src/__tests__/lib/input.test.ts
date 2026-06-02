import { describe, it, expect } from "vitest";
import { toHalfWidth, normalizeFamilyCode, normalizeChildCode } from "@/lib/input";

describe("toHalfWidth", () => {
  it("全角英大文字を半角に変換すること", () => {
    expect(toHalfWidth("ＡＢＣ")).toBe("ABC");
  });

  it("全角英小文字を半角に変換すること", () => {
    expect(toHalfWidth("ａｂｃ")).toBe("abc");
  });

  it("全角数字を半角に変換すること", () => {
    expect(toHalfWidth("１２３４")).toBe("1234");
  });

  it("全角英数混合を半角に変換すること", () => {
    expect(toHalfWidth("ＡＢＣ１２３")).toBe("ABC123");
  });

  it("半角文字はそのまま通過すること", () => {
    expect(toHalfWidth("ABC123")).toBe("ABC123");
  });

  it("空文字でも動作すること", () => {
    expect(toHalfWidth("")).toBe("");
  });

  it("ひらがな・カタカナは変換しないこと", () => {
    expect(toHalfWidth("あいうえお")).toBe("あいうえお");
    expect(toHalfWidth("アイウエオ")).toBe("アイウエオ");
  });

});

describe("normalizeFamilyCode", () => {
  it("全角を半角大文字に変換し 6 文字に切り詰める", () => {
    expect(normalizeFamilyCode("ａｂｃ１２３")).toBe("ABC123");
  });

  it("小文字を大文字化する", () => {
    expect(normalizeFamilyCode("abc123")).toBe("ABC123");
  });

  it("7 文字以上は切り詰める", () => {
    expect(normalizeFamilyCode("ABCDEFG")).toBe("ABCDEF");
  });

  it("空文字でも動作する", () => {
    expect(normalizeFamilyCode("")).toBe("");
  });
});

describe("normalizeChildCode", () => {
  it("全角数字を半角に変換し 4 文字に切り詰める", () => {
    expect(normalizeChildCode("１２３４")).toBe("1234");
  });

  it("数字以外を除去する", () => {
    expect(normalizeChildCode("A1B2C3")).toBe("123");
  });

  it("5 文字以上は切り詰める", () => {
    expect(normalizeChildCode("12345")).toBe("1234");
  });

  it("空文字でも動作する", () => {
    expect(normalizeChildCode("")).toBe("");
  });
});
