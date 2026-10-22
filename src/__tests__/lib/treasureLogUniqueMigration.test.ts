import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Issue #187: STREAK と PROXY は互いに代替枠なので、同じ一意性バケットに入れる必要がある。
const sql = readFileSync(
  join(
    process.cwd(),
    "prisma/migrations/20261022000001_treasure_log_unique_active/migration.sql",
  ),
  "utf8",
).replace(/--.*$/gm, "");

const BUCKET = /CASE\s+WHEN\s+"trigger"\s*=\s*'ALL_COMPLETE'\s+THEN\s+1\s+ELSE\s+0\s+END/i;

describe("TreasureLog 部分ユニークインデックス migration", () => {
  it("一意キーは生の trigger ではなく STREAK/PROXY を同一視したバケットを使う", () => {
    const idx = sql.slice(sql.indexOf("CREATE UNIQUE INDEX"));
    expect(idx).toMatch(BUCKET);
    expect(idx).not.toMatch(/\(\s*"childId"\s*,\s*"date"\s*,\s*"trigger"\s*\)/);
    expect(idx).toMatch(/WHERE\s+"status"\s*<>\s*'CANCELLED'/);
  });

  it("重複解消の PARTITION BY も同じバケットを使う", () => {
    const part = sql.slice(sql.indexOf("PARTITION BY"), sql.indexOf("ORDER BY"));
    expect(part).toMatch(BUCKET);
    expect(part).not.toMatch(/"trigger"\s*$/);
  });
});
