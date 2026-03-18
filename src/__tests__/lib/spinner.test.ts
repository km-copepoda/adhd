import { describe, it, expect } from "vitest";
import { getSpinnerSizeClass } from "@/lib/spinner";

describe("getSpinnerSizeClass", () => {
  it("sm サイズは w-6 h-6 を返す", () => {
    expect(getSpinnerSizeClass("sm")).toBe("w-6 h-6");
  });

  it("md サイズは w-12 h-12 を返す", () => {
    expect(getSpinnerSizeClass("md")).toBe("w-12 h-12");
  });

  it("lg サイズは w-20 h-20 を返す", () => {
    expect(getSpinnerSizeClass("lg")).toBe("w-20 h-20");
  });

  it("引数なし（デフォルト）は md と同じ w-12 h-12 を返す", () => {
    expect(getSpinnerSizeClass()).toBe("w-12 h-12");
  });
});
