import { describe, it, expect } from "vitest";
import { drawCollectionItem } from "@/lib/collectionDraw";
import type { CollectionItem } from "@/lib/collectionItems";

const pool: CollectionItem[] = [
  { id: "c1", season: "summer", category: "creature", rarity: "COMMON",   name: "C1", description: "", image: "/x.png" },
  { id: "c2", season: "summer", category: "food",     rarity: "COMMON",   name: "C2", description: "", image: "/x.png" },
  { id: "u1", season: "summer", category: "jewel",    rarity: "UNCOMMON", name: "U1", description: "", image: "/x.png" },
  { id: "r1", season: "summer", category: "tool",     rarity: "RARE",     name: "R1", description: "", image: "/x.png" },
];

describe("drawCollectionItem", () => {
  it("空プールは null", () => {
    expect(drawCollectionItem([], () => 0.5)).toBeNull();
  });

  it("rng=0.0 は RARE → 当該レアの先頭(or 唯一)を返す", () => {
    // 排他配分: RARE [0, 0.10) / UNCOMMON [0.10, 0.40) / COMMON [0.40, 1.00)
    const item = drawCollectionItem(pool, () => 0.0);
    expect(item?.rarity).toBe("RARE");
    expect(item?.id).toBe("r1");
  });

  it("rng=0.09 はまだ RARE", () => {
    const item = drawCollectionItem(pool, () => 0.09);
    expect(item?.rarity).toBe("RARE");
  });

  it("rng=0.10 ちょうどは UNCOMMON", () => {
    const item = drawCollectionItem(pool, () => 0.10);
    expect(item?.rarity).toBe("UNCOMMON");
  });

  it("rng=0.39 はまだ UNCOMMON", () => {
    const item = drawCollectionItem(pool, () => 0.39);
    expect(item?.rarity).toBe("UNCOMMON");
  });

  it("rng=0.40 は COMMON", () => {
    const item = drawCollectionItem(pool, () => 0.40);
    expect(item?.rarity).toBe("COMMON");
  });

  it("rng=0.99 は COMMON", () => {
    const item = drawCollectionItem(pool, () => 0.99);
    expect(item?.rarity).toBe("COMMON");
  });

  it("当選レアにアイテムが無い場合は降格 (UNCOMMON 抽選で UNCOMMON 0件 → COMMON にフォールバック)", () => {
    const noUncommon: CollectionItem[] = pool.filter((i) => i.rarity !== "UNCOMMON");
    // rng=0.20 → UNCOMMON 抽選だが prevent fall → COMMON へ降格
    // 2nd rng は tier 内アイテム選択用 (0.0 → 先頭)
    let calls = 0;
    const rng = () => (calls++ === 0 ? 0.20 : 0.0);
    const item = drawCollectionItem(noUncommon, rng);
    expect(item?.rarity).toBe("COMMON");
  });

  it("RARE 抽選で RARE 0件 → UNCOMMON にフォールバック", () => {
    const noRare: CollectionItem[] = pool.filter((i) => i.rarity !== "RARE");
    let calls = 0;
    const rng = () => (calls++ === 0 ? 0.0 : 0.0);
    const item = drawCollectionItem(noRare, rng);
    expect(item?.rarity).toBe("UNCOMMON");
  });

  it("RARE 抽選で RARE/UNCOMMON 0件 → COMMON にフォールバック", () => {
    const onlyCommon: CollectionItem[] = pool.filter((i) => i.rarity === "COMMON");
    let calls = 0;
    const rng = () => (calls++ === 0 ? 0.0 : 0.0);
    const item = drawCollectionItem(onlyCommon, rng);
    expect(item?.rarity).toBe("COMMON");
  });

  it("プールに該当レアが複数あるとき 2回目の rng で 1つ選択 (uniform)", () => {
    const twoCommons: CollectionItem[] = [pool[0], pool[1]];
    // rng=0.5 → COMMON、次 0.0 で先頭
    let calls = 0;
    const r = () => (calls++ === 0 ? 0.5 : 0.0);
    const item = drawCollectionItem(twoCommons, r);
    expect(item?.id).toBe("c1");
  });

  it("5000 試行で COMMON ≈ 60% / UNCOMMON ≈ 30% / RARE ≈ 10% (3σ)", () => {
    let common = 0, uncommon = 0, rare = 0;
    const N = 5000;
    // 線形合同生成器を使って決定的に再現可能
    let s = 1234567;
    const rng = () => {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x80000000;
    };
    for (let i = 0; i < N; i++) {
      const item = drawCollectionItem(pool, rng);
      if (!item) continue;
      if (item.rarity === "COMMON") common++;
      else if (item.rarity === "UNCOMMON") uncommon++;
      else rare++;
    }
    // 3σ ≈ 3 * sqrt(N * p * (1-p))
    // COMMON: sqrt(5000*0.6*0.4) ≈ 34.6, 3σ ≈ 104
    // UNCOMMON: sqrt(5000*0.3*0.7) ≈ 32.4, 3σ ≈ 97
    // RARE: sqrt(5000*0.1*0.9) ≈ 21.2, 3σ ≈ 64
    expect(Math.abs(common - 3000)).toBeLessThan(150);
    expect(Math.abs(uncommon - 1500)).toBeLessThan(120);
    expect(Math.abs(rare - 500)).toBeLessThan(80);
  });
});
