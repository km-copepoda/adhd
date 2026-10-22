import { describe, it, expect } from "vitest";
import { drawCollectionItem, UNOWNED_WEIGHT } from "@/lib/collectionDraw";
import type { CollectionItem } from "@/lib/collectionItems";

const pool: CollectionItem[] = [
  { id: "c1", season: "summer", category: "creature", rarity: "COMMON",   name: "C1", nameKana: "C1", description: "", descriptionKana: "", image: "/x.png" },
  { id: "c2", season: "summer", category: "food",     rarity: "COMMON",   name: "C2", nameKana: "C2", description: "", descriptionKana: "", image: "/x.png" },
  { id: "u1", season: "summer", category: "jewel",    rarity: "UNCOMMON", name: "U1", nameKana: "U1", description: "", descriptionKana: "", image: "/x.png" },
  { id: "r1", season: "summer", category: "tool",     rarity: "RARE",     name: "R1", nameKana: "R1", description: "", descriptionKana: "", image: "/x.png" },
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

// ─── 未所持優先 (ゆるめ): 未所持の重み UNOWNED_WEIGHT(=3) / 所持済み 1 ─────────────
function mk(id: string, rarity: CollectionItem["rarity"]): CollectionItem {
  return { id, season: "summer", category: "creature", rarity, name: id, nameKana: id, description: "", descriptionKana: "", image: "/x.png" };
}

// 1回目=tier用, 2回目=階層内選択用
function seq(first: number, second: number) {
  let calls = 0;
  return () => (calls++ === 0 ? first : second);
}

describe("drawCollectionItem 未所持優先", () => {
  const commons = [mk("c1", "COMMON"), mk("c2", "COMMON")];

  it("UNOWNED_WEIGHT は 3", () => {
    expect(UNOWNED_WEIGHT).toBe(3);
  });

  it("ownedIds 省略と空 Set は従来結果と同じ (階層内一様)", () => {
    for (const second of [0, 0.49, 0.5, 0.99]) {
      const base = drawCollectionItem(commons, seq(0.5, second));
      expect(drawCollectionItem(commons, seq(0.5, second), new Set())?.id).toBe(base?.id);
      expect(drawCollectionItem(commons, seq(0.5, second), undefined)?.id).toBe(base?.id);
    }
    expect(drawCollectionItem(commons, seq(0.5, 0.49), new Set())?.id).toBe("c1");
    expect(drawCollectionItem(commons, seq(0.5, 0.5), new Set())?.id).toBe("c2");
  });

  it("未所持1・所持済み1 (1:3): 所持済みが先頭なら 2回目 0.0 / 0.24 → 所持済み, 0.25 / 0.999 → 未所持", () => {
    const owned = new Set(["c1"]); // c2 が未所持
    expect(drawCollectionItem(commons, seq(0.5, 0.0), owned)?.id).toBe("c1");
    expect(drawCollectionItem(commons, seq(0.5, 0.24), owned)?.id).toBe("c1");
    expect(drawCollectionItem(commons, seq(0.5, 0.25), owned)?.id).toBe("c2");
    expect(drawCollectionItem(commons, seq(0.5, 0.999), owned)?.id).toBe("c2");
  });

  it("pool 内の順序で累積: 未所持が先頭でも同じ境界 (0.74/0.75)", () => {
    const owned = new Set(["c2"]); // c1 が未所持
    expect(drawCollectionItem(commons, seq(0.5, 0.74), owned)?.id).toBe("c1");
    expect(drawCollectionItem(commons, seq(0.5, 0.75), owned)?.id).toBe("c2");
  });

  it("階層内が全て所持済みなら均等 (1:1)", () => {
    const owned = new Set(["c1", "c2"]);
    expect(drawCollectionItem(commons, seq(0.5, 0.49), owned)?.id).toBe("c1");
    expect(drawCollectionItem(commons, seq(0.5, 0.5), owned)?.id).toBe("c2");
  });

  it("未所持が複数のとき各重みに従う (所持1 + 未所持2: 重み 1/3/3, 総和7)", () => {
    const three = [mk("c1", "COMMON"), mk("c2", "COMMON"), mk("c3", "COMMON")];
    const owned = new Set(["c1"]);
    // 境界: 1/7 (~0.1429), 4/7 (~0.5714)
    expect(drawCollectionItem(three, seq(0.5, 0.14), owned)?.id).toBe("c1");
    expect(drawCollectionItem(three, seq(0.5, 0.15), owned)?.id).toBe("c2");
    expect(drawCollectionItem(three, seq(0.5, 0.57), owned)?.id).toBe("c2");
    expect(drawCollectionItem(three, seq(0.5, 0.58), owned)?.id).toBe("c3");
    expect(drawCollectionItem(three, seq(0.5, 0.999999), owned)?.id).toBe("c3");
  });

  it("降格: RARE 当選だが RARE なし → UNCOMMON の所持状況で重み付け", () => {
    const p = [mk("u1", "UNCOMMON"), mk("u2", "UNCOMMON"), mk("c1", "COMMON")];
    // u1 のみ所持 (u2 未所持) → 重み 1:3、境界 0.25
    const owned = new Set(["u1"]);
    expect(drawCollectionItem(p, seq(0.0, 0.24), owned)?.id).toBe("u1");
    expect(drawCollectionItem(p, seq(0.0, 0.25), owned)?.id).toBe("u2");
    // COMMON の所持状況は無関係
    expect(drawCollectionItem(p, seq(0.0, 0.25), new Set(["u1", "c1"]))?.id).toBe("u2");
  });

  it("降格: UNCOMMON 当選で UNCOMMON なし → COMMON の所持状況で重み付け", () => {
    const owned = new Set(["c1"]);
    expect(drawCollectionItem(commons, seq(0.2, 0.24), owned)?.id).toBe("c1");
    expect(drawCollectionItem(commons, seq(0.2, 0.25), owned)?.id).toBe("c2");
  });

  it("FREE プール相当 (C2/U2/R1) で全所持でも必ず何かが返る", () => {
    const free = [mk("c1", "COMMON"), mk("c2", "COMMON"), mk("u1", "UNCOMMON"), mk("u2", "UNCOMMON"), mk("r1", "RARE")];
    const all = new Set(free.map((i) => i.id));
    for (const first of [0, 0.09, 0.1, 0.39, 0.4, 0.99]) {
      for (const second of [0, 0.5, 0.999999]) {
        expect(drawCollectionItem(free, seq(first, second), all)).not.toBeNull();
      }
    }
  });

  it("空プールは ownedIds があっても null", () => {
    expect(drawCollectionItem([], () => 0.5, new Set(["x"]))).toBeNull();
  });

  it("乱数の消費回数は 2 回のまま", () => {
    let calls = 0;
    drawCollectionItem(commons, () => { calls++; return 0.5; }, new Set(["c1"]));
    expect(calls).toBe(2);
  });

  it("統計: 未所持1:所持済み1 の階層で未所持が約75% (±2%)、レア度比率は ownedIds の有無で不変", () => {
    const p = [mk("c1", "COMMON"), mk("c2", "COMMON"), mk("u1", "UNCOMMON"), mk("u2", "UNCOMMON"), mk("r1", "RARE")];
    const owned = new Set(["c1", "u1"]); // c2, u2 が未所持
    const N = 60000;
    const makeRng = () => {
      let s = 987654321;
      return () => {
        s = (s * 1103515245 + 12345) & 0x7fffffff;
        return s / 0x80000000;
      };
    };
    const rng = makeRng();
    const rngNo = makeRng();
    let commonTotal = 0, commonUnowned = 0;
    const withTier = { COMMON: 0, UNCOMMON: 0, RARE: 0 };
    const withoutTier = { COMMON: 0, UNCOMMON: 0, RARE: 0 };
    for (let i = 0; i < N; i++) {
      const a = drawCollectionItem(p, rng, owned)!;
      withTier[a.rarity]++;
      if (a.rarity === "COMMON") {
        commonTotal++;
        if (a.id === "c2") commonUnowned++;
      }
      withoutTier[drawCollectionItem(p, rngNo)!.rarity]++;
    }
    expect(Math.abs(commonUnowned / commonTotal - 0.75)).toBeLessThan(0.02);
    expect(Math.abs(withTier.COMMON / N - 0.6)).toBeLessThan(0.02);
    expect(Math.abs(withTier.UNCOMMON / N - 0.3)).toBeLessThan(0.02);
    expect(Math.abs(withTier.RARE / N - 0.1)).toBeLessThan(0.02);
    expect(Math.abs(withoutTier.COMMON / N - 0.6)).toBeLessThan(0.02);
    expect(Math.abs(withTier.COMMON - withoutTier.COMMON) / N).toBeLessThan(0.02);
  });
});
