import { describe, it, expect, vi, afterEach } from "vitest";
import crypto from "node:crypto";
import { generateFamilyCode, generateChildCode } from "@/lib/codeGenerator";

afterEach(() => vi.restoreAllMocks());

describe("コード生成の乱数源（#184）", () => {
  it("generateFamilyCode は Math.random を使わず crypto.randomInt を使うこと", () => {
    const rnd = vi.spyOn(Math, "random");
    const spy = vi.spyOn(crypto, "randomInt");
    const code = generateFamilyCode();
    expect(spy).toHaveBeenCalledTimes(6);
    expect(spy).toHaveBeenCalledWith(32);
    expect(rnd).not.toHaveBeenCalled();
    expect(code).toMatch(/^[A-Z2-9]{6}$/);
  });

  it("generateChildCode は crypto.randomInt を使い、4桁数字（先頭0も許容）であること", () => {
    const rnd = vi.spyOn(Math, "random");
    const spy = vi.spyOn(crypto, "randomInt").mockReturnValue(0 as never);
    expect(generateChildCode()).toBe("0000");
    expect(spy).toHaveBeenCalledTimes(4);
    expect(spy).toHaveBeenCalledWith(10);
    expect(rnd).not.toHaveBeenCalled();
  });

  it("randomInt が最小・最大値でも範囲内の文字になること（境界）", () => {
    const spy = vi.spyOn(crypto, "randomInt");
    spy.mockImplementation(((n: number) => n - 1) as never);
    expect(generateFamilyCode()).toBe("999999");
    expect(generateChildCode()).toBe("9999");
    spy.mockImplementation((() => 0) as never);
    expect(generateFamilyCode()).toBe("AAAAAA");
  });
});
