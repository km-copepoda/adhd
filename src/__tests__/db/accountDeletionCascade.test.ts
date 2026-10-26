import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

// アカウント削除（#235）の FK 方針を schema.prisma / migration.sql から静的に検査する。
// DB には接続しない。CRLF の作業コピーでも動くよう \r?\n で分割する。

const ROOT = path.resolve(__dirname, "../../..");
const schema = fs.readFileSync(path.join(ROOT, "prisma/schema.prisma"), "utf8");

const MIGRATION_DIR = "20261023000003_account_deletion_cascade";
const migrationPath = path.join(ROOT, "prisma/migrations", MIGRATION_DIR, "migration.sql");

const stripSqlComments = (sql: string) =>
  sql
    .split(/\r?\n/)
    .map((line) => line.replace(/--.*$/, ""))
    .join("\n");

/** model ブロック内で `<field> <Type> @relation(...)` の行を返す */
function relationLine(model: string, field: string): string | undefined {
  const lines = schema.split(/\r?\n/);
  const start = lines.findIndex((l) => new RegExp(`^model\\s+${model}\\s*\\{`).test(l));
  if (start < 0) return undefined;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^\}/.test(lines[i])) break;
    if (new RegExp(`^\\s+${field}\\s+\\w+\\??\\s+@relation\\(`).test(lines[i])) return lines[i];
  }
  return undefined;
}

describe("schema.prisma: アカウント削除の FK", () => {
  it.each([
    ["QuestInstance", "child"],
    ["Streak", "child"],
    ["TaskStreak", "child"],
    ["TaskTemplate", "family"],
  ])("%s.%s は onDelete: Cascade", (model, field) => {
    const line = relationLine(model, field);
    expect(line, `${model}.${field} の @relation が見つからない`).toBeDefined();
    expect(line).toMatch(/onDelete:\s*Cascade/);
  });

  it.each([
    ["QuestInstance", "template"],
    ["TaskStreak", "task"],
  ])("%s.%s は onDelete 指定なし（RESTRICT のまま。タスクは論理削除運用）", (model, field) => {
    const line = relationLine(model, field);
    expect(line, `${model}.${field} の @relation が見つからない`).toBeDefined();
    expect(line).not.toMatch(/onDelete/);
  });

  it.each([
    ["User", "family"],
    ["TaskTemplate", "assignedChild"],
  ])("%s.%s は Cascade ではない（User.family は SET NULL のまま、削除順で担保）", (model, field) => {
    const line = relationLine(model, field);
    expect(line, `${model}.${field} の @relation が見つからない`).toBeDefined();
    expect(line).not.toMatch(/onDelete:\s*Cascade/);
  });

  it("テスト自体の健全性: 既存の Cascade（Subscription.user）を検出できる", () => {
    expect(relationLine("Subscription", "user")).toMatch(/onDelete:\s*Cascade/);
  });
});

describe(`migration ${MIGRATION_DIR}`, () => {
  it("migration.sql が存在する", () => {
    expect(fs.existsSync(migrationPath), `${migrationPath} が無い`).toBe(true);
  });

  const sql = () => stripSqlComments(fs.readFileSync(migrationPath, "utf8"));

  it.each([
    ["QuestInstance", "QuestInstance_childId_fkey", "childId", "User"],
    ["Streak", "Streak_childId_fkey", "childId", "User"],
    ["TaskStreak", "TaskStreak_childId_fkey", "childId", "User"],
    ["TaskTemplate", "TaskTemplate_familyId_fkey", "familyId", "Family"],
  ])("%s: %s を DROP して ON DELETE CASCADE で再作成する", (table, constraint, column, ref) => {
    const s = sql();
    expect(s).toMatch(
      new RegExp(`ALTER\\s+TABLE\\s+"${table}"\\s+DROP\\s+CONSTRAINT\\s+"${constraint}"`, "i"),
    );
    expect(s).toMatch(
      new RegExp(
        `ALTER\\s+TABLE\\s+"${table}"\\s+ADD\\s+CONSTRAINT\\s+"${constraint}"\\s+FOREIGN\\s+KEY\\s*\\("${column}"\\)\\s+REFERENCES\\s+"${ref}"\\s*\\("id"\\)\\s+ON\\s+DELETE\\s+CASCADE`,
        "i",
      ),
    );
  });

  it.each([
    "QuestInstance_templateId_fkey",
    "TaskStreak_taskId_fkey",
    "User_familyId_fkey",
    "TaskTemplate_assignedChildId_fkey",
  ])("%s は変更しない（RESTRICT / SET NULL のまま）", (constraint) => {
    expect(sql()).not.toContain(constraint);
  });

  it("ON DELETE CASCADE はちょうど 4 件（意図しない Cascade を増やさない）", () => {
    const count = (sql().match(/ON\s+DELETE\s+CASCADE/gi) ?? []).length;
    expect(count).toBe(4);
  });

  it("新規テーブルを作らない（RLS の追加が不要）", () => {
    expect(sql()).not.toMatch(/CREATE\s+TABLE/i);
  });
});
