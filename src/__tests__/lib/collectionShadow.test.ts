// 未取得コレクションアイテムのシルエット (影) 用パスヘルパの担保。
// 目的:
//  - Network タブや DevTools で本物の絵を覗かせない (CSS filter 方式だと
//    元画像を DL してから加工するため実データが漏れる)
//  - 転送量削減 (単色 + アルファなので webp が非常に小さい)
//
// 実ファイルは scripts/gen-collection-shadows.mjs で public/collection-items/shadow/
// 配下に生成する。ItemsContent は未取得アイテムでこの path を使う。

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  ALL_COLLECTION_ITEMS,
  getCollectionShadowPath,
} from "@/lib/collectionItems";

describe("getCollectionShadowPath", () => {
  it("season 画像を shadow/{season} に置き換える", () => {
    expect(getCollectionShadowPath("/collection-items/summer/カブトムシ.webp")).toBe(
      "/collection-items/shadow/summer/カブトムシ.webp",
    );
    expect(getCollectionShadowPath("/collection-items/spring/桜龍.webp")).toBe(
      "/collection-items/shadow/spring/桜龍.webp",
    );
    expect(getCollectionShadowPath("/collection-items/fall/月うさぎ.webp")).toBe(
      "/collection-items/shadow/fall/月うさぎ.webp",
    );
    expect(getCollectionShadowPath("/collection-items/winter/氷龍.webp")).toBe(
      "/collection-items/shadow/winter/氷龍.webp",
    );
  });

  it("monthly 画像を shadow/monthly に置き換える", () => {
    expect(getCollectionShadowPath("/collection-items/monthly/ラムネ.webp")).toBe(
      "/collection-items/shadow/monthly/ラムネ.webp",
    );
  });

  it("DUMMY 画像 (プレースホルダ) はそのまま返す", () => {
    // ダミーは既にシルエット的な扱いなので変換しない
    expect(getCollectionShadowPath("/collection-items/dummy.webp")).toBe(
      "/collection-items/dummy.webp",
    );
  });

  it("既に shadow パスならそのまま返す (冪等)", () => {
    expect(
      getCollectionShadowPath("/collection-items/shadow/summer/カブトムシ.webp"),
    ).toBe("/collection-items/shadow/summer/カブトムシ.webp");
  });
});

describe("collection shadow files on disk", () => {
  for (const item of ALL_COLLECTION_ITEMS) {
    const shadow = getCollectionShadowPath(item.image);
    // dummy は変換されないのでスキップ (dummy 自体は images テストで存在担保済み)
    if (shadow === item.image) continue;
    it(`${item.id} (${item.name}) の shadow ファイルが public 上に存在する`, () => {
      const rel = shadow.replace(/^\//, "");
      const filePath = path.join(process.cwd(), "public", rel);
      const exists = fs.existsSync(filePath);
      if (!exists) {
        throw new Error(
          `shadow not found: ${shadow} (item id=${item.id}, name=${item.name})`,
        );
      }
      expect(exists).toBe(true);
    });
  }

  it("shadow ファイルは元画像より小さい (単色圧縮でサイズ削減)", () => {
    // サンプルとして summer/カブトムシ で確認
    const src = path.join(
      process.cwd(),
      "public/collection-items/summer/カブトムシ.webp",
    );
    const dst = path.join(
      process.cwd(),
      "public/collection-items/shadow/summer/カブトムシ.webp",
    );
    const srcSize = fs.statSync(src).size;
    const dstSize = fs.statSync(dst).size;
    expect(dstSize).toBeLessThan(srcSize);
  });
});
