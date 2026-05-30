import { describe, it, expect } from "vitest";
import {
  drawTreasure,
  RARITY_BASE_PROBABILITY,
  RARITY_BOOSTED_MULTIPLIER,
  PITY_THRESHOLD,
  RARITY_ORDER,
  type TreasurePoolItem,
} from "@/lib/treasure";

// rng を制御するためのヘルパ。配列の値を順に返す。
function seq(values: number[]): () => number {
  let i = 0;
  return () => {
    const v = values[i] ?? 0;
    i++;
    return v;
  };
}

// 排他的単発抽選モデル:
//   u in [0,       1/28)              → RARE
//   u in [1/28,    1/28 + 1/14)       → UNCOMMON
//   u in [1/28+1/14, 1/28+1/14+1/7)   → COMMON
//   u in [1/4,     1.0)               → MISS
const RARE_HIT = 0.01;       // < 1/28 ≈ 0.0357
const UNCOMMON_HIT = 0.05;   // in [0.0357, 0.107)
const COMMON_HIT = 0.15;     // in [0.107, 0.25)
const MISS = 0.5;            // >= 0.25

const pool3 = (): TreasurePoolItem[] => [
  { id: "c1", title: "おやつ", rarity: "COMMON" },
  { id: "u1", title: "アイス", rarity: "UNCOMMON" },
  { id: "r1", title: "本", rarity: "RARE" },
];

describe("treasure constants", () => {
  it("COMMON は 1/7", () => {
    expect(RARITY_BASE_PROBABILITY.COMMON).toBeCloseTo(1 / 7, 10);
  });
  it("UNCOMMON は 1/14", () => {
    expect(RARITY_BASE_PROBABILITY.UNCOMMON).toBeCloseTo(1 / 14, 10);
  });
  it("RARE は 1/28", () => {
    expect(RARITY_BASE_PROBABILITY.RARE).toBeCloseTo(1 / 28, 10);
  });
  it("ボーナス倍率は 1.5", () => {
    expect(RARITY_BOOSTED_MULTIPLIER).toBe(1.5);
  });
  it("天井閾値は 5", () => {
    expect(PITY_THRESHOLD).toBe(5);
  });
  it("レア度順序: RARE > UNCOMMON > COMMON", () => {
    expect(RARITY_ORDER.RARE).toBeGreaterThan(RARITY_ORDER.UNCOMMON);
    expect(RARITY_ORDER.UNCOMMON).toBeGreaterThan(RARITY_ORDER.COMMON);
  });
});

describe("drawTreasure — プールが空", () => {
  it("null を返し、ピティカウンタは進めない", () => {
    const res = drawTreasure([], { pityCount: 3, rng: seq([0.0, 0.0]) });
    expect(res.itemId).toBeNull();
    expect(res.rarity).toBeNull();
    expect(res.nextPityCount).toBe(3);
    expect(res.pityTriggered).toBe(false);
  });

  it("プールが空ならピティが溜まっていても発動しない", () => {
    const res = drawTreasure([], { pityCount: PITY_THRESHOLD, rng: seq([0.0]) });
    expect(res.itemId).toBeNull();
    expect(res.nextPityCount).toBe(PITY_THRESHOLD);
    expect(res.pityTriggered).toBe(false);
  });
});

describe("drawTreasure — 排他的単発抽選 (合計 hit 率 = 1/7+1/14+1/28 = 1/4)", () => {
  it("u=0.01 < 1/28 → RARE", () => {
    // 1: rarity 判定 (RARE)
    // 2: tier 内アイテム選択 → floor(0.0 * 1) = 0
    const res = drawTreasure(pool3(), {
      rng: seq([RARE_HIT, 0.0]),
    });
    expect(res.rarity).toBe("RARE");
    expect(res.itemId).toBe("r1");
    expect(res.nextPityCount).toBe(0);
  });

  it("u=0.05 in [1/28, 1/28+1/14) → UNCOMMON", () => {
    const res = drawTreasure(pool3(), {
      rng: seq([UNCOMMON_HIT, 0.0]),
    });
    expect(res.rarity).toBe("UNCOMMON");
    expect(res.itemId).toBe("u1");
    expect(res.nextPityCount).toBe(0);
  });

  it("u=0.15 in [1/28+1/14, 1/4) → COMMON", () => {
    const res = drawTreasure(pool3(), {
      rng: seq([COMMON_HIT, 0.0]),
    });
    expect(res.rarity).toBe("COMMON");
    expect(res.itemId).toBe("c1");
    expect(res.nextPityCount).toBe(0);
  });

  it("u=0.5 (>= 1/4) → MISS、ピティ +1", () => {
    const res = drawTreasure(pool3(), { pityCount: 1, rng: seq([MISS]) });
    expect(res.itemId).toBeNull();
    expect(res.rarity).toBeNull();
    expect(res.nextPityCount).toBe(2);
    expect(res.pityTriggered).toBe(false);
  });

  it("rarity 判定は 1 回の rng で完結する (旧仕様の独立3回抽選にはならない)", () => {
    let calls = 0;
    drawTreasure(pool3(), {
      rng: () => {
        calls++;
        return 0.5; // miss
      },
    });
    // MISS 時は rarity 判定 1 回のみで終わる（旧仕様は 3回 → 新仕様は 1回）
    expect(calls).toBe(1);
  });
});

describe("drawTreasure — 統計的に 28 回の期待値 ≒ 4:2:1:21", () => {
  it("seed なし 5000 回試行で各レア度の出現比が 4:2:1（ハズレ 21）に近い (±2σ)", () => {
    const N = 5000;
    const counts = { COMMON: 0, UNCOMMON: 0, RARE: 0, MISS: 0 };
    // Mulberry32 — 決定論シード PRNG（CI でブレないように）
    let state = 0xdeadbeef;
    const rng = () => {
      state |= 0;
      state = (state + 0x6d2b79f5) | 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    for (let i = 0; i < N; i++) {
      const res = drawTreasure(pool3(), { rng });
      if (res.rarity) counts[res.rarity]++;
      else counts.MISS++;
    }
    // 期待値 (×N): COMMON=N/7, UNCOMMON=N/14, RARE=N/28, MISS=3N/4
    const expCommon = N / 7;
    const expUncommon = N / 14;
    const expRare = N / 28;
    // 二項分布の標準偏差 σ = sqrt(N*p*(1-p))
    const sigmaCommon = Math.sqrt(N * (1 / 7) * (6 / 7));
    const sigmaUncommon = Math.sqrt(N * (1 / 14) * (13 / 14));
    const sigmaRare = Math.sqrt(N * (1 / 28) * (27 / 28));
    // 3σ で 99.7% の範囲に入る
    expect(Math.abs(counts.COMMON - expCommon)).toBeLessThan(3 * sigmaCommon);
    expect(Math.abs(counts.UNCOMMON - expUncommon)).toBeLessThan(3 * sigmaUncommon);
    expect(Math.abs(counts.RARE - expRare)).toBeLessThan(3 * sigmaRare);
  });
});

describe("drawTreasure — boosted (確率1.5倍、各レア度別)", () => {
  it("RARE の領域が広がる: 通常 1/28 → boosted 1.5/28 ≈ 0.0536", () => {
    // 通常域では UNCOMMON、boosted 域では RARE になる境界
    // u = 0.04 → boosted では < 1.5/28 で RARE 領域
    const res = drawTreasure(pool3(), {
      boosted: true,
      rng: seq([0.04, 0.0]),
    });
    expect(res.rarity).toBe("RARE");
  });

  it("boosted=false で同じ u は UNCOMMON", () => {
    const res = drawTreasure(pool3(), {
      boosted: false,
      rng: seq([0.04, 0.0]),
    });
    expect(res.rarity).toBe("UNCOMMON");
  });

  it("boosted 合計 hit 率は 1.5 × 1/4 = 0.375 — u=0.4 はハズレ", () => {
    const res = drawTreasure(pool3(), {
      boosted: true,
      rng: seq([0.4]),
    });
    expect(res.itemId).toBeNull();
  });

  it("boosted で u=0.3 < 0.375 → COMMON 領域", () => {
    const res = drawTreasure(pool3(), {
      boosted: true,
      rng: seq([0.3, 0.0]),
    });
    expect(res.rarity).toBe("COMMON");
  });
});

describe("drawTreasure — 当たりレア度がプールに無い場合は降格", () => {
  it("RARE 当選だがプールに RARE 無 → UNCOMMON に降格", () => {
    const pool: TreasurePoolItem[] = [
      { id: "c1", title: "A", rarity: "COMMON" },
      { id: "u1", title: "B", rarity: "UNCOMMON" },
    ];
    const res = drawTreasure(pool, {
      rng: seq([RARE_HIT, 0.0]),
    });
    expect(res.rarity).toBe("UNCOMMON");
    expect(res.itemId).toBe("u1");
  });

  it("RARE 当選だが RARE / UNCOMMON 共に無 → COMMON に降格", () => {
    const pool: TreasurePoolItem[] = [
      { id: "c1", title: "A", rarity: "COMMON" },
    ];
    const res = drawTreasure(pool, {
      rng: seq([RARE_HIT, 0.0]),
    });
    expect(res.rarity).toBe("COMMON");
    expect(res.itemId).toBe("c1");
  });

  it("UNCOMMON 当選だが UNCOMMON 無 → COMMON に降格", () => {
    const pool: TreasurePoolItem[] = [
      { id: "c1", title: "A", rarity: "COMMON" },
      { id: "r1", title: "B", rarity: "RARE" },
    ];
    const res = drawTreasure(pool, {
      rng: seq([UNCOMMON_HIT, 0.0]),
    });
    expect(res.rarity).toBe("COMMON");
    expect(res.itemId).toBe("c1");
  });

  it("当選レア度以下のいずれもプールに無い → ハズレ扱い (pity +1)", () => {
    // UNCOMMON 当選だが、プールには RARE しかない（COMMON も無）
    const pool: TreasurePoolItem[] = [
      { id: "r1", title: "B", rarity: "RARE" },
    ];
    const res = drawTreasure(pool, {
      rng: seq([UNCOMMON_HIT]),
    });
    expect(res.itemId).toBeNull();
    expect(res.rarity).toBeNull();
    expect(res.nextPityCount).toBe(1);
  });

  it("当選レア度より上には絶対に昇格しない (UNCOMMON 当選 / プール RARE のみ → ハズレ)", () => {
    const pool: TreasurePoolItem[] = [
      { id: "r1", title: "B", rarity: "RARE" },
    ];
    const res = drawTreasure(pool, {
      rng: seq([COMMON_HIT]),
    });
    expect(res.itemId).toBeNull();
    expect(res.rarity).toBeNull();
  });
});

describe("drawTreasure — プールサイズ非依存 (2026-05-29 既決定の継続)", () => {
  it("COMMON 100 個のプールでも MISS rng はハズレ", () => {
    const pool: TreasurePoolItem[] = Array.from({ length: 100 }, (_, i) => ({
      id: `c${i}`,
      title: `${i}`,
      rarity: "COMMON" as const,
    }));
    const res = drawTreasure(pool, { rng: seq([MISS]) });
    expect(res.itemId).toBeNull();
  });

  it("COMMON HIT 時、tier 内アイテムは均等抽選される", () => {
    const pool: TreasurePoolItem[] = Array.from({ length: 5 }, (_, i) => ({
      id: `c${i + 1}`,
      title: `${i + 1}`,
      rarity: "COMMON" as const,
    }));
    // floor(0.5 * 5) = 2 → c3
    const res = drawTreasure(pool, { rng: seq([COMMON_HIT, 0.5]) });
    expect(res.itemId).toBe("c3");
  });
});

describe("drawTreasure — 天井(ピティ)", () => {
  it("pityCount=5 で自然ハズレなら強制で1個出る", () => {
    // rng 1: rarity 判定 (MISS) → ピティ発動 → rng 2: 強制ピック (プール全体)
    const res = drawTreasure(pool3(), {
      pityCount: PITY_THRESHOLD,
      rng: seq([MISS, 0.0]),
    });
    expect(res.itemId).not.toBeNull();
    expect(res.nextPityCount).toBe(0);
    expect(res.pityTriggered).toBe(true);
  });

  it("pityCount=5 で自然当たりがあるなら通常通り (pityTriggered=false)", () => {
    const res = drawTreasure(pool3(), {
      pityCount: PITY_THRESHOLD,
      rng: seq([COMMON_HIT, 0.0]),
    });
    expect(res.rarity).toBe("COMMON");
    expect(res.nextPityCount).toBe(0);
    expect(res.pityTriggered).toBe(false);
  });

  it("pityCount=PITY_THRESHOLD-1 (4) で自然ハズレならまだ発動しない (ピティ +1=5)", () => {
    const res = drawTreasure(pool3(), {
      pityCount: PITY_THRESHOLD - 1,
      rng: seq([MISS]),
    });
    expect(res.itemId).toBeNull();
    expect(res.nextPityCount).toBe(PITY_THRESHOLD);
    expect(res.pityTriggered).toBe(false);
  });

  it("強制ピック時 rng の値でアイテムが決まる", () => {
    // pool 長3、roll=0.5 → floor(0.5*3)=1 → index 1 (u1)
    const res = drawTreasure(pool3(), {
      pityCount: PITY_THRESHOLD,
      rng: seq([MISS, 0.5]),
    });
    expect(res.itemId).toBe("u1");
  });

  it("当選したが降格でハズレに落ちたケースもピティを進める", () => {
    // UNCOMMON 当選だが、プールは RARE のみ → 昇格は禁止、降格先も無 → ハズレ
    const pool: TreasurePoolItem[] = [
      { id: "r1", title: "B", rarity: "RARE" },
    ];
    const res = drawTreasure(pool, {
      pityCount: 2,
      rng: seq([UNCOMMON_HIT]),
    });
    expect(res.itemId).toBeNull();
    expect(res.nextPityCount).toBe(3);
  });
});

describe("drawTreasure — rng デフォルト", () => {
  it("rng を省略しても動作する (Math.random)", () => {
    for (let i = 0; i < 50; i++) {
      const res = drawTreasure(pool3(), { pityCount: 0 });
      expect(["COMMON", "UNCOMMON", "RARE", null]).toContain(res.rarity);
    }
  });
});
