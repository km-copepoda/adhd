import { describe, it, expect } from "vitest";
import {
  drawTreasure,
  RARITY_BASE_PROBABILITY,
  RARITY_BOOSTED_MULTIPLIER,
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
//   u in [0,         1/45)              → RARE
//   u in [1/45,      1/45 + 1/20)       → UNCOMMON
//   u in [1/45+1/20, 1/45+1/20+1/10)    → COMMON
//   u in [31/180,    1.0)               → MISS
// 合計 hit 率 = 1/10 + 1/20 + 1/45 = 31/180 ≈ 0.1722
const RARE_HIT = 0.01;       // < 1/45 ≈ 0.0222
const UNCOMMON_HIT = 0.05;   // in [0.0222, 0.0722)
const COMMON_HIT = 0.15;     // in [0.0722, 0.1722)
const MISS = 0.5;            // >= 0.1722

const pool3 = (): TreasurePoolItem[] => [
  { id: "c1", title: "おやつ", rarity: "COMMON" },
  { id: "u1", title: "アイス", rarity: "UNCOMMON" },
  { id: "r1", title: "本", rarity: "RARE" },
];

describe("treasure constants", () => {
  it("COMMON は 1/10", () => {
    expect(RARITY_BASE_PROBABILITY.COMMON).toBeCloseTo(1 / 10, 10);
  });
  it("UNCOMMON は 1/20", () => {
    expect(RARITY_BASE_PROBABILITY.UNCOMMON).toBeCloseTo(1 / 20, 10);
  });
  it("RARE は 1/45", () => {
    expect(RARITY_BASE_PROBABILITY.RARE).toBeCloseTo(1 / 45, 10);
  });
  it("ボーナス倍率は 1.5", () => {
    expect(RARITY_BOOSTED_MULTIPLIER).toBe(1.5);
  });
  it("レア度順序: RARE > UNCOMMON > COMMON", () => {
    expect(RARITY_ORDER.RARE).toBeGreaterThan(RARITY_ORDER.UNCOMMON);
    expect(RARITY_ORDER.UNCOMMON).toBeGreaterThan(RARITY_ORDER.COMMON);
  });
});

describe("drawTreasure — プールが空", () => {
  it("null を返す", () => {
    const res = drawTreasure([], { rng: seq([0.0, 0.0]) });
    expect(res.itemId).toBeNull();
    expect(res.rarity).toBeNull();
  });
});

describe("drawTreasure — 排他的単発抽選 (合計 hit 率 = 1/10+1/20+1/45 = 31/180)", () => {
  it("u=0.01 < 1/45 → RARE", () => {
    const res = drawTreasure(pool3(), {
      rng: seq([RARE_HIT, 0.0]),
    });
    expect(res.rarity).toBe("RARE");
    expect(res.itemId).toBe("r1");
  });

  it("u=0.05 in [1/45, 1/45+1/20) → UNCOMMON", () => {
    const res = drawTreasure(pool3(), {
      rng: seq([UNCOMMON_HIT, 0.0]),
    });
    expect(res.rarity).toBe("UNCOMMON");
    expect(res.itemId).toBe("u1");
  });

  it("u=0.15 in [1/45+1/20, 31/180) → COMMON", () => {
    const res = drawTreasure(pool3(), {
      rng: seq([COMMON_HIT, 0.0]),
    });
    expect(res.rarity).toBe("COMMON");
    expect(res.itemId).toBe("c1");
  });

  it("u=0.5 (>= 31/180) → MISS (itemId=null, rarity=null)", () => {
    const res = drawTreasure(pool3(), { rng: seq([MISS]) });
    expect(res.itemId).toBeNull();
    expect(res.rarity).toBeNull();
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

describe("drawTreasure — 統計的に 180 回の期待値 ≒ 18:9:4:149", () => {
  it("seed なし 5000 回試行で各レア度の出現比が 18:9:4（ハズレ 149）に近い (±3σ)", () => {
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
    const expCommon = N / 10;
    const expUncommon = N / 20;
    const expRare = N / 45;
    const sigmaCommon = Math.sqrt(N * (1 / 10) * (9 / 10));
    const sigmaUncommon = Math.sqrt(N * (1 / 20) * (19 / 20));
    const sigmaRare = Math.sqrt(N * (1 / 45) * (44 / 45));
    expect(Math.abs(counts.COMMON - expCommon)).toBeLessThan(3 * sigmaCommon);
    expect(Math.abs(counts.UNCOMMON - expUncommon)).toBeLessThan(3 * sigmaUncommon);
    expect(Math.abs(counts.RARE - expRare)).toBeLessThan(3 * sigmaRare);
  });
});

describe("drawTreasure — boosted (確率1.5倍、各レア度別)", () => {
  it("RARE の領域が広がる: 通常 1/45 ≈ 0.0222 → boosted 1.5/45 ≈ 0.0333", () => {
    const res = drawTreasure(pool3(), {
      boosted: true,
      rng: seq([0.025, 0.0]),
    });
    expect(res.rarity).toBe("RARE");
  });

  it("boosted=false で同じ u は UNCOMMON", () => {
    const res = drawTreasure(pool3(), {
      boosted: false,
      rng: seq([0.025, 0.0]),
    });
    expect(res.rarity).toBe("UNCOMMON");
  });

  it("boosted 合計 hit 率は 1.5 × 31/180 = 31/120 ≈ 0.2583 — u=0.4 はハズレ", () => {
    const res = drawTreasure(pool3(), {
      boosted: true,
      rng: seq([0.4]),
    });
    expect(res.itemId).toBeNull();
  });

  it("boosted で u=0.2 < 31/120 → COMMON 領域", () => {
    const res = drawTreasure(pool3(), {
      boosted: true,
      rng: seq([0.2, 0.0]),
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

  it("当選レア度以下のいずれもプールに無い → ハズレ扱い (itemId=null)", () => {
    // UNCOMMON 当選だが、プールには RARE しかない（COMMON も無）
    const pool: TreasurePoolItem[] = [
      { id: "r1", title: "B", rarity: "RARE" },
    ];
    const res = drawTreasure(pool, {
      rng: seq([UNCOMMON_HIT]),
    });
    expect(res.itemId).toBeNull();
    expect(res.rarity).toBeNull();
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

describe("drawTreasure — rng デフォルト", () => {
  it("rng を省略しても動作する (Math.random)", () => {
    for (let i = 0; i < 50; i++) {
      const res = drawTreasure(pool3());
      expect(["COMMON", "UNCOMMON", "RARE", null]).toContain(res.rarity);
    }
  });
});
