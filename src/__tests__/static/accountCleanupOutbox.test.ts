import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

// 外部削除 outbox（AccountCleanupJob）の静的検査（#235, Codex P1 対応）

const ROOT = path.resolve(__dirname, "../../..");
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");

describe("AccountCleanupJob outbox: 静的検査", () => {
  it("schema.prisma に AccountCleanupJob モデル（payload Json / attempts Int / lastError / updatedAt）がある", () => {
    const schema = read("prisma/schema.prisma");
    const m = schema.match(/model\s+AccountCleanupJob\s*\{[\s\S]*?\n\}/);
    expect(m, "model AccountCleanupJob が無い").not.toBeNull();
    expect(m![0]).toMatch(/payload\s+Json/);
    expect(m![0]).toMatch(/attempts\s+Int\s+@default\(0\)/);
    expect(m![0]).toMatch(/lastError\s+String\?/);
    expect(m![0]).toMatch(/updatedAt\s+DateTime\s+@updatedAt/);
  });

  it("migration 20261023000004_account_cleanup_job が CREATE TABLE と ENABLE ROW LEVEL SECURITY を含み、ポリシーを作らない", () => {
    const p = "prisma/migrations/20261023000004_account_cleanup_job/migration.sql";
    expect(fs.existsSync(path.join(ROOT, p)), `${p} が無い`).toBe(true);
    const sql = read(p);
    expect(sql).toMatch(/CREATE TABLE\s+"AccountCleanupJob"/);
    expect(sql).toMatch(/ALTER TABLE\s+"AccountCleanupJob"\s+ENABLE ROW LEVEL SECURITY/);
    expect(sql).not.toMatch(/CREATE\s+POLICY/i);
  });

  it("vercel.json の crons に /api/cron/account-cleanup がある", () => {
    const v = JSON.parse(read("vercel.json")) as { crons: { path: string; schedule: string }[] };
    const c = v.crons.find((x) => x.path === "/api/cron/account-cleanup");
    expect(c, "cron 未登録").toBeDefined();
    expect(c!.schedule).toMatch(/^\S+ \S+ \S+ \S+ \S+$/);
  });

  it("既存の cron が消えていない（auto-approve / quest-time-notify）", () => {
    const v = JSON.parse(read("vercel.json")) as { crons: { path: string }[] };
    const paths = v.crons.map((x) => x.path);
    expect(paths).toContain("/api/cron/auto-approve");
    expect(paths).toContain("/api/cron/quest-time-notify");
  });
});
