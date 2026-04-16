import { describe, it, expect } from "vitest";
import {
  computeEvolutionWeights,
  applyEggBonus,
  checkEvolution,
  MIN_EVOLUTION_PROBABILITY,
  EVOLUTION_THRESHOLDS,
  REBIRTH_THRESHOLD,
  REBIRTH_EGG_THRESHOLD,
} from "@/lib/evolution";

// ─── MIN_EVOLUTION_PROBABILITY ──────────────────────────────────────────────
describe("MIN_EVOLUTION_PROBABILITY", () => {
  it("0.15 である", () => {
    expect(MIN_EVOLUTION_PROBABILITY).toBe(0.15);
  });
});

// ─── computeEvolutionWeights ─────────────────────────────────────────────────
describe("computeEvolutionWeights — 上限60%の保証", () => {
  it("study全振りで STUDY が 60% に達する", () => {
    const w = computeEvolutionWeights(10, 0, 0);
    expect(w.STUDY).toBeCloseTo(0.6, 10);
  });

  it("study全振りでも STAMINA・LIFE は 20% を維持（floor不要）", () => {
    const w = computeEvolutionWeights(10, 0, 0);
    expect(w.STAMINA).toBeCloseTo(0.2, 10);
    expect(w.LIFE).toBeCloseTo(0.2, 10);
  });

  it("支配パスは 60% を超えない", () => {
    expect(computeEvolutionWeights(100, 0, 0).STUDY).toBeLessThanOrEqual(0.6 + 1e-10);
    expect(computeEvolutionWeights(0, 100, 0).STAMINA).toBeLessThanOrEqual(0.6 + 1e-10);
    expect(computeEvolutionWeights(0, 0, 100).LIFE).toBeLessThanOrEqual(0.6 + 1e-10);
  });
});

describe("computeEvolutionWeights — 下限保証", () => {
  it("study=5, stamina=0, life=5 → STAMINA=15%, STUDY/LIFEは均等に減る", () => {
    const w = computeEvolutionWeights(5, 0, 5);
    expect(w.STAMINA).toBeCloseTo(MIN_EVOLUTION_PROBABILITY, 5);
    expect(w.STUDY).toBeCloseTo(0.5 - MIN_EVOLUTION_PROBABILITY / 2, 5);
    expect(w.LIFE).toBeCloseTo(0.5 - MIN_EVOLUTION_PROBABILITY / 2, 5);
  });

  it("study=7, stamina=0, life=3 → STAMINA=15%、STUDY/LIFEは比例的に減る", () => {
    // rawWeights: STUDY=0.6(キャップ), LIFE=0.4, STAMINA=0
    // STAMINA に 0.15 補填 → STUDY/LIFE から比例的に取る
    // STUDY above floor = 0.6-0.15=0.45, LIFE above floor = 0.4-0.15=0.25, total=0.70
    // STUDY -= 0.15*(0.45/0.70) ≈ 0.0964 → 0.5036
    // LIFE  -= 0.15*(0.25/0.70) ≈ 0.0536 → 0.3464
    const w = computeEvolutionWeights(7, 0, 3);
    expect(w.STAMINA).toBeCloseTo(0.15, 5);
    expect(w.STUDY).toBeCloseTo(0.6 - 0.15 * (0.45 / 0.70), 5);
    expect(w.LIFE).toBeCloseTo(0.4 - 0.15 * (0.25 / 0.70), 5);
  });

  it("全パスが floor 以上のとき変化しない（study=5, stamina=3, life=2）", () => {
    const w1 = computeEvolutionWeights(5, 3, 2);
    // 全パスが既に15%以上のはず → floorの補填なし
    expect(w1.STUDY).toBeGreaterThanOrEqual(MIN_EVOLUTION_PROBABILITY);
    expect(w1.STAMINA).toBeGreaterThanOrEqual(MIN_EVOLUTION_PROBABILITY);
    expect(w1.LIFE).toBeGreaterThanOrEqual(MIN_EVOLUTION_PROBABILITY);
  });

  it("study=0, stamina=5, life=5 → STUDY=15%", () => {
    const w = computeEvolutionWeights(0, 5, 5);
    expect(w.STUDY).toBeCloseTo(MIN_EVOLUTION_PROBABILITY, 5);
  });

  it("study=5, stamina=5, life=0 → LIFE=15%", () => {
    const w = computeEvolutionWeights(5, 5, 0);
    expect(w.LIFE).toBeCloseTo(MIN_EVOLUTION_PROBABILITY, 5);
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
      [7, 0, 3],
    ] as const;
    for (const [s, st, l] of cases) {
      const w = computeEvolutionWeights(s, st, l);
      expect(w.STUDY + w.STAMINA + w.LIFE).toBeCloseTo(1, 10);
    }
  });
});

// ─── applyEggBonus ───────────────────────────────────────────────────────────
describe("applyEggBonus", () => {
  it("指定カテゴリが +20% され合計は 1.0 のまま", () => {
    const w = { STUDY: 1 / 3, STAMINA: 1 / 3, LIFE: 1 / 3 };
    applyEggBonus(w, "STUDY");
    expect(w.STUDY).toBeCloseTo(1 / 3 + 0.2, 5);
    expect(w.STUDY + w.STAMINA + w.LIFE).toBeCloseTo(1, 10);
  });

  it("既に高い確率のパスにボーナスを付けても合計は 1.0", () => {
    const w = { STUDY: 0.6, STAMINA: 0.2, LIFE: 0.2 };
    applyEggBonus(w, "STUDY");
    expect(w.STUDY + w.STAMINA + w.LIFE).toBeCloseTo(1, 10);
    expect(w.STUDY).toBeLessThanOrEqual(1);
  });

  it("存在しないカテゴリを指定しても変化しない", () => {
    const w = { STUDY: 0.5, STAMINA: 0.3, LIFE: 0.2 };
    applyEggBonus(w, "INVALID");
    expect(w.STUDY).toBeCloseTo(0.5, 10);
    expect(w.STAMINA).toBeCloseTo(0.3, 10);
    expect(w.LIFE).toBeCloseTo(0.2, 10);
  });

  it("STAMINA ボーナス: STUDY・LIFE が比例的に減る", () => {
    const w = { STUDY: 0.4, STAMINA: 0.2, LIFE: 0.4 };
    applyEggBonus(w, "STAMINA");
    expect(w.STAMINA).toBeCloseTo(0.4, 5);
    expect(w.STUDY + w.STAMINA + w.LIFE).toBeCloseTo(1, 10);
  });
});

// ─── checkEvolution ──────────────────────────────────────────────────────────
describe("checkEvolution — 進化なし", () => {
  it("stage1(閾値10pt)でpt=5のとき進化しない", () => {
    const r = checkEvolution(1, "STUDY", 5, 0, 0);
    expect(r.evolved).toBe(false);
    expect(r.reborn).toBe(false);
    expect(r.newStage).toBe(1);
  });

  it("stage3(最終形態)でREBIRTH_THRESHOLD未満のとき進化も転生もしない", () => {
    const r = checkEvolution(3, "STUDY_STAMINA_LIFE", 0, 0, REBIRTH_THRESHOLD - 1);
    expect(r.evolved).toBe(false);
    expect(r.reborn).toBe(false);
  });
});

describe("checkEvolution — 進化", () => {
  it("stage0(卵,閾値1pt)でpt=1のとき進化する", () => {
    const r = checkEvolution(0, "", 1, 0, 0);
    expect(r.evolved).toBe(true);
    expect(r.newStage).toBe(1);
    expect(r.newPath).toMatch(/^(STUDY|STAMINA|LIFE)$/);
    expect(r.resetStudy).toBe(0);
  });

  it("stage1(閾値10pt)でpt=10のとき進化してパスが追記される", () => {
    const r = checkEvolution(1, "STUDY", 10, 0, 0);
    expect(r.evolved).toBe(true);
    expect(r.newStage).toBe(2);
    expect(r.newPath).toMatch(/^STUDY_(STUDY|STAMINA|LIFE)$/);
  });

  it("stage2(閾値30pt)でpt=30のとき進化してstage3になる", () => {
    const r = checkEvolution(2, "STUDY_STAMINA", 30, 0, 0);
    expect(r.evolved).toBe(true);
    expect(r.newStage).toBe(3);
    expect(r.newPath).toMatch(/^STUDY_STAMINA_(STUDY|STAMINA|LIFE)$/);
  });
});

describe("checkEvolution — 転生", () => {
  it("stage3でREBIRTH_THRESHOLD以上のとき reborn=true になる", () => {
    const r = checkEvolution(3, "STUDY_STAMINA_LIFE", REBIRTH_THRESHOLD, 0, 0);
    expect(r.evolved).toBe(false);
    expect(r.reborn).toBe(true);
    expect(r.newStage).toBe(0);
    expect(r.newPath).toBe("");
  });
});

describe("checkEvolution — 転生後の卵(isReborn=true)", () => {
  it("isReborn=true のとき孵化閾値が REBIRTH_EGG_THRESHOLD になる", () => {
    // REBIRTH_EGG_THRESHOLD=5 なので pt=1 では孵化しない
    const r1 = checkEvolution(0, "", 1, 0, 0, true);
    expect(r1.evolved).toBe(false);

    // pt=5 で孵化する
    const r2 = checkEvolution(0, "", 5, 0, 0, true);
    expect(r2.evolved).toBe(true);
    expect(r2.newStage).toBe(1);
  });

  it("isReborn=false(初回卵)のとき pt=1 で孵化する", () => {
    const r = checkEvolution(0, "", 1, 0, 0, false);
    expect(r.evolved).toBe(true);
  });
});

describe("EVOLUTION_THRESHOLDS / REBIRTH_THRESHOLD 定数確認", () => {
  it("stage0→1 の閾値は 1pt", () => expect(EVOLUTION_THRESHOLDS[0]).toBe(1));
  it("stage1→2 の閾値は 10pt", () => expect(EVOLUTION_THRESHOLDS[1]).toBe(10));
  it("stage2→3 の閾値は 30pt", () => expect(EVOLUTION_THRESHOLDS[2]).toBe(30));
  it("stage3 は最終形態(null)", () => expect(EVOLUTION_THRESHOLDS[3]).toBeNull());
  it("REBIRTH_THRESHOLD は 20pt", () => expect(REBIRTH_THRESHOLD).toBe(20));
  it("REBIRTH_EGG_THRESHOLD は 5pt", () => expect(REBIRTH_EGG_THRESHOLD).toBe(5));
});
