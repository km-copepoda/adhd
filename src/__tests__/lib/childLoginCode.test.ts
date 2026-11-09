import { describe, it, expect, vi, afterEach } from "vitest";
import crypto from "node:crypto";
import {
  generateLoginCode,
  hashLoginCode,
  normalizeLoginCode,
} from "@/lib/childLoginCode";

afterEach(() => vi.restoreAllMocks());

// 紛らわしい文字（I, O, 0, 1）を除いた32文字種（家族コードと同じ）
const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

describe("generateLoginCode（#184）", () => {
  it("8文字で、許可された32文字種だけからなること", () => {
    for (let i = 0; i < 200; i++) {
      expect(generateLoginCode()).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/);
    }
  });

  it("紛らわしい文字（I, O, 0, 1）を含まないこと", () => {
    for (let i = 0; i < 200; i++) {
      expect(generateLoginCode()).not.toMatch(/[IO01]/);
    }
  });

  it("Math.random を使わず crypto.randomInt(32) を8回呼ぶこと", () => {
    const rnd = vi.spyOn(Math, "random");
    const spy = vi.spyOn(crypto, "randomInt");
    generateLoginCode();
    expect(spy).toHaveBeenCalledTimes(8);
    expect(spy).toHaveBeenCalledWith(32);
    expect(rnd).not.toHaveBeenCalled();
  });

  it("randomInt が最小・最大値でも範囲内の文字になること（境界）", () => {
    const spy = vi.spyOn(crypto, "randomInt");
    spy.mockImplementation((() => 0) as never);
    expect(generateLoginCode()).toBe(CHARS[0].repeat(8));
    spy.mockImplementation(((n: number) => n - 1) as never);
    expect(generateLoginCode()).toBe(CHARS[31].repeat(8));
  });

  it("連続して生成しても重複しない（ほぼ衝突しない）こと", () => {
    const set = new Set(Array.from({ length: 1000 }, () => generateLoginCode()));
    expect(set.size).toBeGreaterThan(990);
  });
});

describe("hashLoginCode", () => {
  it("sha256 の hex（64文字）を返すこと", () => {
    const expected = crypto.createHash("sha256").update("ABCD2345").digest("hex");
    expect(hashLoginCode("ABCD2345")).toBe(expected);
    expect(hashLoginCode("ABCD2345")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("同じ入力には同じ値（決定的）、違う入力には違う値を返すこと", () => {
    expect(hashLoginCode("ABCD2345")).toBe(hashLoginCode("ABCD2345"));
    expect(hashLoginCode("ABCD2345")).not.toBe(hashLoginCode("ABCD2346"));
  });

  it("平文のコードを含まないこと", () => {
    expect(hashLoginCode("ABCD2345")).not.toContain("ABCD2345");
  });
});

describe("normalizeLoginCode", () => {
  it.each([
    { label: "そのまま", input: "ABCD2345", expected: "ABCD2345" },
    { label: "前後の空白を除去", input: "  ABCD2345\n", expected: "ABCD2345" },
    { label: "小文字を大文字に", input: "abcd2345", expected: "ABCD2345" },
    { label: "全角英数字を半角に", input: "ＡＢＣＤ２３４５", expected: "ABCD2345" },
    { label: "全角小文字を半角大文字に", input: "ａｂｃｄ２３４５", expected: "ABCD2345" },
    { label: "ハイフン等の区切りを除去", input: "ABCD-2345", expected: "ABCD2345" },
    { label: "中間の空白を除去", input: "AB CD 23 45", expected: "ABCD2345" },
    { label: "許可外の文字（I O 0 1）を除去", input: "AIBOC0D1", expected: "ABCD" },
    { label: "日本語や絵文字を除去", input: "ABあ😀CD2345", expected: "ABCD2345" },
    { label: "空文字は空文字", input: "", expected: "" },
    { label: "許可文字がなければ空文字", input: "!!!   ---", expected: "" },
  ])("$label", ({ input, expected }) => {
    expect(normalizeLoginCode(input)).toBe(expected);
  });

  it("長さの切り詰めはしない（9文字以上はそのまま返し、呼び出し側が長さで検証する）", () => {
    expect(normalizeLoginCode("ABCD23456")).toBe("ABCD23456");
  });

  it("生成したコードを正規化しても変わらないこと", () => {
    for (let i = 0; i < 50; i++) {
      const code = generateLoginCode();
      expect(normalizeLoginCode(code)).toBe(code);
    }
  });
});
