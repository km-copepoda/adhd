import { describe, it, expect } from "vitest";
import { getS3Aura } from "@/lib/s3Aura";

describe("getS3Aura", () => {
  it("lv0（未収集）は null を返す", () => {
    expect(getS3Aura(0)).toBeNull();
  });

  it("lv1 は紫 (#a78bfa) でglow/pulseなし", () => {
    const aura = getS3Aura(1);
    expect(aura).not.toBeNull();
    expect(aura!.r).toBe(167);
    expect(aura!.g).toBe(139);
    expect(aura!.b).toBe(250);
    expect(aura!.borderWidth).toBe(2);
    expect(aura!.borderAlpha).toBe(0.5);
    expect(aura!.bgAlpha).toBe(0.05);
    expect(aura!.glow).toBe(false);
    expect(aura!.pulse).toBe(false);
  });

  it("lv2 はロイヤルブルー (#4169E1)", () => {
    const aura = getS3Aura(2);
    expect(aura!.r).toBe(65);
    expect(aura!.g).toBe(105);
    expect(aura!.b).toBe(225);
    expect(aura!.glow).toBe(false);
    expect(aura!.pulse).toBe(false);
  });

  it("lv3 はターコイズ (#2dd4bf)", () => {
    const aura = getS3Aura(3);
    expect(aura!.r).toBe(45);
    expect(aura!.g).toBe(212);
    expect(aura!.b).toBe(191);
    expect(aura!.glow).toBe(false);
  });

  it("lv4 は黄緑 (#a3e635) で glow あり", () => {
    const aura = getS3Aura(4);
    expect(aura!.r).toBe(163);
    expect(aura!.g).toBe(230);
    expect(aura!.b).toBe(53);
    expect(aura!.glow).toBe(true);
    expect(aura!.pulse).toBe(false);
  });

  it("lv5 はゴールド (#fbbf24) で glow + pulse あり、borderWidth 3", () => {
    const aura = getS3Aura(5);
    expect(aura!.r).toBe(251);
    expect(aura!.g).toBe(191);
    expect(aura!.b).toBe(36);
    expect(aura!.borderWidth).toBe(3);
    expect(aura!.borderAlpha).toBe(0.7);
    expect(aura!.bgAlpha).toBe(0.1);
    expect(aura!.glow).toBe(true);
    expect(aura!.pulse).toBe(true);
  });

  it("lv5 より大きい値は lv5 と同じ設定（上限クランプ）", () => {
    const aura5 = getS3Aura(5);
    const aura10 = getS3Aura(10);
    expect(aura10).toEqual(aura5);
  });
});
