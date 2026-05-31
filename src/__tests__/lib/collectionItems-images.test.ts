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
