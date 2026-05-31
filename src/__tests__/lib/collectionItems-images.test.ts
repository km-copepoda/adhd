// マスター定義の image パスが実ファイルと一致することを担保する。
// 旧バグ: summer-01 が "カブトムシ.png" を参照していたが実ファイルは "かぶとむし.png" で、
// 404 によりコレクション画面でシルエット表示になっていた。
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { ALL_COLLECTION_ITEMS } from "@/lib/collectionItems";

const DUMMY_IMAGE = "/collection-items/dummy.webp";

describe("collectionItems image paths", () => {
  it("ダミー画像は public 上に存在する", () => {
    const filePath = path.join(process.cwd(), "public", DUMMY_IMAGE);
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it("全アイテムで name === image のベース名 (仕様書とファイル名の整合性)", () => {
    // 過去事例: 仕様書「カブトムシ」だが画像が「かぶとむし」、仕様書「ローズクォーツ」だが
    // 画像が「ローズクオーツ」など揺れがあり、name と image を別々に管理していた。
    // 2026-05-31 から命名規約 = 仕様書 (name) を Single Source of Truth とし、
    // 画像ファイル名は必ず name と一致させる。
    const drifts: string[] = [];
    for (const item of ALL_COLLECTION_ITEMS) {
      const base = path.basename(item.image).replace(/\.webp$/, "");
      if (base !== item.name) {
        drifts.push(`${item.id}: name="${item.name}" but image basename="${base}"`);
      }
    }
    if (drifts.length > 0) {
      throw new Error("name vs image filename mismatch:\n" + drifts.join("\n"));
    }
  });

  for (const item of ALL_COLLECTION_ITEMS) {
    it(`${item.id} (${item.name}) の image が public 上に存在する`, () => {
      const rel = item.image.replace(/^\//, "");
      const filePath = path.join(process.cwd(), "public", rel);
      const exists = fs.existsSync(filePath);
      if (!exists) {
        throw new Error(
          `image not found on disk: ${item.image} (item id=${item.id}, name=${item.name})`,
        );
      }
      expect(exists).toBe(true);
    });
  }
});
