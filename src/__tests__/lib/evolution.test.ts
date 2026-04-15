import { describe, it, expect } from "vitest";
import {
  computeEvolutionWeights,
  checkEvolution,
  MIN_EVOLUTION_PROBABILITY,
} from "@/lib/evolution";

describe("MIN_EVOLUTION_PROBABILITY", () => {
  it("10% 以上の値が定義されている", () => {
    expect(MIN_EVOLUTION_PROBABILITY).toBeGreaterThanOrEqual(0.1);
  });
});

describe("computeEvolutionWeights — 上限60%の保証", () => {
  it("study全振りで STUDY が 60% に達する（上限キャップそのまま）", () => {
    const w = computeEvolutionWeights(10, 0, 0);
    expect(w.STUDY).toBeCloseTo(0.6, 10);
  });

  it("study全振りでも STAMINA・LIFE は 20% を維持（floor不要な場合は変化なし）", () => {
    const w = computeEvolutionWeights(10, 0, 0);
    expect(w.STAMINA).toBeCloseTo(0.2, 10);
    expect(w.LIFE).toBeCloseTo(0.2, 10);
  });
});

describe("computeEvolutionWeights — 下限保証（0ptのパスへの補填）", () => {
  it("study=5, stamina=0, life=5 のとき STAMINA が floor 以上になる", () => {
    const w = computeEvolutionWeights(5, 0, 5);
    expect(w.STAMINA).toBeGreaterThanOrEqual(MIN_EVOLUTION_PROBABILITY);
  });

  it("study=5, stamina=0, life=5 のとき STUDY・LIFE はほぼ均等に減る", () => {
    const w = computeEvolutionWeights(5, 0, 5);
    expect(w.STUDY).toBeCloseTo(0.5 - MIN_EVOLUTION_PROBABILITY / 2, 5);
    expect(w.LIFE).toBeCloseTo(0.5 - MIN_EVOLUTION_PROBABILITY / 2, 5);
  });

  it("study=0, stamina=5, life=5 のとき STUDY が floor 以上になる", () => {
    const w = computeEvolutionWeights(0, 5, 5);
    expect(w.STUDY).toBeGreaterThanOrEqual(MIN_EVOLUTION_PROBABILITY);
  });

  it("study=5, stamina=5, life=0 のとき LIFE が floor 以上になる", () => {
    const w = computeEvolutionWeights(5, 5, 0);
    expect(w.LIFE).toBeGreaterThanOrEqual(MIN_EVOLUTION_PROBABILITY);
  });
});

describe("computeEvolutionWeights — 基本性質", () => {
  it("全パラメータ0のとき均等 (1/3)", () => {
    const w = computeEvolutionWeights(0, 0, 0);
    expect(w.STUDY).toBeCloseTo(1 / 3, 5);
    expect(w.STAMINA).toBeCloseTo(1 / 3, 5);
    expect(w.LIFE).toBeCloseTo(1 / 3, 5);
  });

  it("全パス均等のとき各パスはほぼ 1/3", () => {
    const w = computeEvolutionWeights(5, 5, 5);
    expect(w.STUDY).toBeCloseTo(1 / 3, 5);
    expect(w.STAMINA).toBeCloseTo(1 / 3, 5);
    expect(w.LIFE).toBeCloseTo(1 / 3, 5);
  });

  it("合計は常に 1.0 になる", () => {
    const cases = [
      [5, 0, 5],
      [10, 0, 0],
      [0, 0, 0],
      [3, 7, 2],
      [1, 1, 1],
      [0, 3, 7],
    ] as const;
    for (const [s, st, l] of cases) {
      const w = computeEvolutionWeights(s, st, l);
      expect(w.STUDY + w.STAMINA + w.LIFE).toBeCloseTo(1, 10);
    }
  });

  it("支配パスは 60% を超えない", () => {
    expect(computeEvolutionWeights(100, 0, 0).STUDY).toBeLessThanOrEqual(0.6 + 1e-10);
    expect(computeEvolutionWeights(0, 100, 0).STAMINA).toBeLessThanOrEqual(0.6 + 1e-10);
    expect(computeEvolutionWeights(0, 0, 100).LIFE).toBeLessThanOrEqual(0.6 + 1e-10);
  });
});

describe("checkEvolution — 進化パス選択", () => {
  it("stage1(閾値10pt)でpt=5のとき進化しない", () => {
    const result = checkEvolution(1, "STUDY", 5, 0, 0);
    expect(result.evolved).toBe(false);
  });

  it("stage0(卵,閾値1pt)でpt=1のとき進化してパスが追記される", () => {
    const result = checkEvolution(0, "", 1, 0, 0);
    expect(result.evolved).toBe(true);
    expect(result.newPath).toMatch(/^(STUDY|STAMINA|LIFE)$/);
  });
});
