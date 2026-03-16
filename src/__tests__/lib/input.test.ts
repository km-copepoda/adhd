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

  // ログイン画面の実際の使われ方
  it("全角ファミリーコードを半角大文字に変換できること", () => {
    const raw = "ａｂｃ１２３";
    const result = toHalfWidth(raw).toUpperCase().slice(0, 6);
    expect(result).toBe("ABC123");
  });

  it("全角数字のユーザーコードを半角数字のみに変換できること", () => {
    const raw = "１２３４";
    const result = toHalfWidth(raw).replace(/\D/g, "").slice(0, 4);
    expect(result).toBe("1234");
  });
});
