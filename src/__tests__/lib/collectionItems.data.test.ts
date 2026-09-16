// Issue #139: モンスター図鑑・コレクションアイテムのかなデータ層
//
// CollectionItem に nameKana / descriptionKana フィールドが実装されていることを検証する
// データ整合性テスト（実装前の現時点では存在しないため red、実装後に green になる）。

import { describe, it, expect } from "vitest";
import { ALL_COLLECTION_ITEMS } from "@/lib/collectionItems";

const KANJI_PATTERN = /[一-鿿]/;

type WithKana = { id: string; nameKana?: string; descriptionKana?: string };

describe("CollectionItem のかなフィールド（実装後にgreenになる想定）", () => {
  it("全140件が定義されている", () => {
    expect(ALL_COLLECTION_ITEMS).toHaveLength(140);
  });

  it("全アイテムにnameKana/descriptionKanaが存在し非空である", () => {
    for (const item of ALL_COLLECTION_ITEMS as unknown as WithKana[]) {
      expect(item.nameKana, `${item.id}.nameKana`).toBeTruthy();
      expect(item.descriptionKana, `${item.id}.descriptionKana`).toBeTruthy();
    }
  });

  it("nameKana/descriptionKanaに漢字が残っていない", () => {
    for (const item of ALL_COLLECTION_ITEMS as unknown as WithKana[]) {
      expect(item.nameKana ?? "").not.toMatch(KANJI_PATTERN);
      expect(item.descriptionKana ?? "").not.toMatch(KANJI_PATTERN);
    }
  });

  it("idが重複していない", () => {
    const ids = ALL_COLLECTION_ITEMS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
