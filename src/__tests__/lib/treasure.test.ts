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

const COMMON_HIT = 0.05; // 1/7 ≈ 0.143 未満なら当たり
const COMMON_MISS = 0.5;
const UNCOMMON_HIT = 0.04; // 1/14 ≈ 0.071 未満なら当たり
const UNCOMMON_MISS = 0.5;
const RARE_HIT = 0.01; // 1/28 ≈ 0.036 未満なら当たり
const RARE_MISS = 0.5;

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
  it("ボーナス倍率は 2", () => {
    expect(RARITY_BOOSTED_MULTIPLIER).toBe(2);
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

describe("drawTreasure — 全ハズレ", () => {
  it("どの roll も MISS なら null・ピティ +1", () => {
    const res = drawTreasure(pool3(), {
      pityCount: 1,
      rng: seq([COMMON_MISS, UNCOMMON_MISS, RARE_MISS]),
    });
    expect(res.itemId).toBeNull();
    expect(res.rarity).toBeNull();
    expect(res.nextPityCount).toBe(2);
    expect(res.pityTriggered).toBe(false);
  });

  it("初期 pityCount=0 のハズレで 1 になる", () => {
    const res = drawTreasure(pool3(), {
      rng: seq([COMMON_MISS, UNCOMMON_MISS, RARE_MISS]),
    });
    expect(res.nextPityCount).toBe(1);
  });
});

describe("drawTreasure — 当たり", () => {
  it("COMMON だけがヒットしたとき COMMON を返し、ピティ 0", () => {
    const res = drawTreasure(pool3(), {
      pityCount: 4,
      rng: seq([COMMON_HIT, UNCOMMON_MISS, RARE_MISS]),
    });
    expect(res.itemId).toBe("c1");
    expect(res.rarity).toBe("COMMON");
    expect(res.nextPityCount).toBe(0);
    expect(res.pityTriggered).toBe(false);
  });

  it("複数ヒットしたら一番レアなものを優先", () => {
    const res = drawTreasure(pool3(), {
      rng: seq([COMMON_HIT, UNCOMMON_HIT, RARE_HIT]),
    });
    expect(res.itemId).toBe("r1");
    expect(res.rarity).toBe("RARE");
  });

  it("COMMON と UNCOMMON のみヒットなら UNCOMMON", () => {
    const res = drawTreasure(pool3(), {
      rng: seq([COMMON_HIT, UNCOMMON_HIT, RARE_MISS]),
    });
    expect(res.itemId).toBe("u1");
    expect(res.rarity).toBe("UNCOMMON");
  });
});

describe("drawTreasure — boosted (確率2倍)", () => {
  it("通常ハズレの roll でも boosted なら当たる", () => {
    // COMMON 通常: 1/7 ≈ 0.143、boosted: 2/7 ≈ 0.286
    // roll = 0.18 → 通常ハズレ、boosted ヒット
    const res = drawTreasure(pool3(), {
      boosted: true,
      rng: seq([0.18, RARE_MISS, RARE_MISS]),
    });
    expect(res.itemId).toBe("c1");
  });

  it("boosted=false で同じ roll はハズレ", () => {
    const res = drawTreasure(pool3(), {
      boosted: false,
      rng: seq([0.18, UNCOMMON_MISS, RARE_MISS]),
    });
    expect(res.itemId).toBeNull();
  });
});

describe("drawTreasure — 天井(ピティ)", () => {
  it("pityCount=5 で自然ハズレなら強制で1個出る", () => {
    // 3アイテム全部ハズレ → 強制ピックの roll が4個目
    const res = drawTreasure(pool3(), {
      pityCount: PITY_THRESHOLD,
      rng: seq([COMMON_MISS, UNCOMMON_MISS, RARE_MISS, 0.0]),
    });
    expect(res.itemId).not.toBeNull();
    expect(res.nextPityCount).toBe(0);
    expect(res.pityTriggered).toBe(true);
  });

  it("pityCount=5 で自然当たりがあるなら通常通り (pityTriggered=false)", () => {
    const res = drawTreasure(pool3(), {
      pityCount: PITY_THRESHOLD,
      rng: seq([COMMON_HIT, UNCOMMON_MISS, RARE_MISS]),
    });
    expect(res.itemId).toBe("c1");
    expect(res.nextPityCount).toBe(0);
    expect(res.pityTriggered).toBe(false);
  });

  it("pityCount=PITY_THRESHOLD-1 (4) で自然ハズレならまだ発動しない (ピティ +1=5)", () => {
    const res = drawTreasure(pool3(), {
      pityCount: PITY_THRESHOLD - 1,
      rng: seq([COMMON_MISS, UNCOMMON_MISS, RARE_MISS]),
    });
    expect(res.itemId).toBeNull();
    expect(res.nextPityCount).toBe(PITY_THRESHOLD);
    expect(res.pityTriggered).toBe(false);
  });

  it("強制ピック時 rng の値でアイテムが決まる", () => {
    // pool 長3、roll=0.5 → floor(0.5*3)=1 → index 1 (u1)
    const res = drawTreasure(pool3(), {
      pityCount: PITY_THRESHOLD,
      rng: seq([COMMON_MISS, UNCOMMON_MISS, RARE_MISS, 0.5]),
    });
    expect(res.itemId).toBe("u1");
  });
});

describe("drawTreasure — rng デフォルト", () => {
  it("rng を省略しても動作する (Math.random)", () => {
    // 100回回して例外が出ないだけ確認 (確率に依存しない最小サニティ)
    for (let i = 0; i < 50; i++) {
      const res = drawTreasure(pool3(), { pityCount: 0 });
      expect(["COMMON", "UNCOMMON", "RARE", null]).toContain(res.rarity);
    }
  });
});

// ─── 新仕様: レア度ごとに独立抽選（プールサイズ非依存）─────────────────────────
describe("drawTreasure — レア度ごとの独立抽選 (プールサイズ非依存)", () => {
  const manyCommons = (): TreasurePoolItem[] => [
    { id: "c1", title: "A", rarity: "COMMON" },
    { id: "c2", title: "B", rarity: "COMMON" },
    { id: "c3", title: "C", rarity: "COMMON" },
    { id: "c4", title: "D", rarity: "COMMON" },
    { id: "c5", title: "E", rarity: "COMMON" },
  ];

  it("COMMON 5個のプールでも COMMON 抽選は 1 回だけ (rng=0.2 → MISS で全 MISS)", () => {
    // 0.2 > 1/7 ≈ 0.143 なので COMMON は MISS。
    // 旧実装はアイテム毎に 5 回 roll するため 5 個目までに当たりが出やすい。
    // 新実装はレア度ごとに 1 回 = 計 3 回の roll で確率を決める。
    const res = drawTreasure(manyCommons(), {
      rng: seq([0.2, 0.2, 0.2]),
    });
    expect(res.itemId).toBeNull();
    expect(res.rarity).toBeNull();
    expect(res.nextPityCount).toBe(1);
  });

  it("COMMON HIT 時、4 回目の rng でプール内のアイテムを選ぶ (floor(rng*tierLen))", () => {
    // rng 消費順:
    //   1: COMMON 抽選 (HIT)
    //   2: UNCOMMON 抽選 (MISS)
    //   3: RARE 抽選 (MISS)
    //   4: アイテム選択 → floor(0.0 * 5) = 0 → c1
    const res = drawTreasure(manyCommons(), {
      rng: seq([COMMON_HIT, UNCOMMON_MISS, RARE_MISS, 0.0]),
    });
    expect(res.itemId).toBe("c1");
    expect(res.rarity).toBe("COMMON");
  });

  it("COMMON HIT 時、アイテム選択 rng の値で別のアイテムが選ばれる", () => {
    // floor(0.5 * 5) = 2 → c3
    const res = drawTreasure(manyCommons(), {
      rng: seq([COMMON_HIT, UNCOMMON_MISS, RARE_MISS, 0.5]),
    });
    expect(res.itemId).toBe("c3");
    expect(res.rarity).toBe("COMMON");
  });

  it("プール100個 COMMON でも rng=0.2 なら MISS (旧実装ではほぼ確実に当たる)", () => {
    const pool: TreasurePoolItem[] = Array.from({ length: 100 }, (_, i) => ({
      id: `c${i}`,
      title: `${i}`,
      rarity: "COMMON" as const,
    }));
    // rng=0.2 を 3 回連続: COMMON/UNCOMMON/RARE すべて MISS
    const res = drawTreasure(pool, { rng: seq([0.2, 0.2, 0.2]) });
    expect(res.itemId).toBeNull();
  });
});

describe("drawTreasure — ヒットしたレア度がプールに無い場合", () => {
  it("RARE+UNCOMMON HIT でも プールに RARE が無ければ UNCOMMON を採用", () => {
    const pool: TreasurePoolItem[] = [
      { id: "c1", title: "A", rarity: "COMMON" },
      { id: "u1", title: "B", rarity: "UNCOMMON" },
    ];
    // 全レア度 HIT。RARE が無いので UNCOMMON に降格 → u1。
    // アイテム選択: floor(0.0 * 1) = 0 → u1
    const res = drawTreasure(pool, {
      rng: seq([COMMON_HIT, UNCOMMON_HIT, RARE_HIT, 0.0]),
    });
    expect(res.rarity).toBe("UNCOMMON");
    expect(res.itemId).toBe("u1");
  });

  it("HIT したレア度のいずれもプールに無ければハズレ扱い (pity +1)", () => {
    const onlyCommon: TreasurePoolItem[] = [
      { id: "c1", title: "おやつ", rarity: "COMMON" },
    ];
    // COMMON は MISS、UNCOMMON も MISS、RARE だけ HIT。プールには COMMON のみ
    const res = drawTreasure(onlyCommon, {
      rng: seq([COMMON_MISS, UNCOMMON_MISS, RARE_HIT]),
    });
    expect(res.itemId).toBeNull();
    expect(res.rarity).toBeNull();
    expect(res.nextPityCount).toBe(1);
  });
});
