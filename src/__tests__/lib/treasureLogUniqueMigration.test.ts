import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Issue #187: STREAK と PROXY は互いに代替枠なので、同じ一意性バケットに入れる必要がある。
// 20261022000001 は Preview DB に適用済みのため編集せず、20261022000002 で区分化する。
const read = (dir: string) =>
  readFileSync(
    join(process.cwd(), "prisma/migrations", dir, "migration.sql"),
    "utf8",
  ).replace(/--.*$/gm, "");

const sql1 = read("20261022000001_treasure_log_unique_active");
const sql = read("20261022000002_treasure_log_unique_active_bucket");

const BUCKET = /CASE\s+WHEN\s+"trigger"\s*=\s*'ALL_COMPLETE'\s+THEN\s+1\s+ELSE\s+0\s+END/i;

describe("TreasureLog 部分ユニークインデックス migration (バケット化)", () => {
  it("適用済みの最初のマイグレーションは生の trigger インデックスのまま (編集されていない)", () => {
    expect(sql1).toMatch(/\(\s*"childId"\s*,\s*"date"\s*,\s*"trigger"\s*\)/);
    expect(sql1).not.toMatch(BUCKET);
  });

  it("一意キーは生の trigger ではなく STREAK/PROXY を同一視したバケットを使う", () => {
    const idx = sql.slice(sql.indexOf("CREATE UNIQUE INDEX"));
    expect(idx).toMatch(BUCKET);
    expect(idx).not.toMatch(/\(\s*"childId"\s*,\s*"date"\s*,\s*"trigger"\s*\)/);
    expect(idx).toMatch(/WHERE\s+"status"\s*<>\s*'CANCELLED'/);
  });

  it("重複解消の PARTITION BY も同じバケットを使い、生の trigger で分割しない", () => {
    const part = sql.slice(sql.indexOf("PARTITION BY"), sql.indexOf("ORDER BY"));
    expect(part).toMatch(BUCKET);
    // バケット式を除いた残りに生の "trigger" 列が単独で現れない
    expect(part.replace(BUCKET, "")).not.toMatch(/"trigger"/);
  });

  it("旧インデックスを DROP IF EXISTS してから作り直す (DROP -> CREATE の順)", () => {
    const drop = sql.search(/DROP\s+INDEX\s+IF\s+EXISTS\s+"TreasureLog_childId_date_trigger_active_key"/i);
    const create = sql.search(/CREATE\s+UNIQUE\s+INDEX/i);
    expect(drop).toBeGreaterThanOrEqual(0);
    expect(create).toBeGreaterThan(drop);
  });

  it("重複解消の UPDATE は DROP / CREATE より前にある", () => {
    const update = sql.search(/UPDATE\s+"TreasureLog"/i);
    const drop = sql.search(/DROP\s+INDEX/i);
    expect(update).toBeGreaterThanOrEqual(0);
    expect(drop).toBeGreaterThan(update);
  });

  it("残す行の優先順位は OPENED > UNLOCKED > LOCKED、次に createdAt、id", () => {
    expect(sql).toMatch(/WHEN 'OPENED' THEN 0\s+WHEN 'UNLOCKED' THEN 1\s+ELSE 2/);
    expect(sql).toMatch(/"createdAt" ASC,\s*"id" ASC/);
    expect(sql).toMatch(/ranked\.rn\s*>\s*1/);
  });
});
