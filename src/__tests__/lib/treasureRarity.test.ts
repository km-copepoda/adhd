import { describe, it, expect } from "vitest";
import {
  RARITY_LABEL,
  RARITY_BADGE_CLASS,
  type TreasureRarity,
} from "@/lib/treasureRarity";

describe("RARITY_LABEL", () => {
  it("3レア度のラベルがある", () => {
    expect(RARITY_LABEL.COMMON).toBe("よく出る");
    expect(RARITY_LABEL.UNCOMMON).toBe("ときどき");
    expect(RARITY_LABEL.RARE).toBe("たまに");
  });
});

describe("RARITY_BADGE_CLASS (dark-palette compliance)", () => {
  const rarities: TreasureRarity[] = ["COMMON", "UNCOMMON", "RARE"];

  it.each(rarities)("%s クラスが定義されている", (r) => {
    expect(RARITY_BADGE_CLASS[r]).toBeTruthy();
  });

  // design-tone-and-manner.md セクション 1 の禁止クラスを使っていない
  const forbidden = [
    "bg-blue-100",
    "bg-blue-200",
    "bg-blue-300",
    "bg-purple-100",
    "bg-purple-200",
    "bg-purple-300",
    "bg-amber-100",
    "bg-amber-200",
    "bg-amber-300",
    "bg-gray-100",
    "bg-gray-200",
    "bg-gray-300",
    "text-white",
  ];

  it.each(rarities)("%s に禁止クラス（ライト bg / text-white）が含まれない", (r) => {
    const cls = RARITY_BADGE_CLASS[r];
    for (const bad of forbidden) {
      // クラス境界（先頭/末尾/空白区切り）でマッチさせ部分一致誤検知を防ぐ
      const re = new RegExp(`(^|\\s)${bad}(\\s|$)`);
      expect(cls).not.toMatch(re);
    }
  });
});
