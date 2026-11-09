import { describe, it, expect } from "vitest";
import { toHalfWidth } from "@/lib/input";

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
