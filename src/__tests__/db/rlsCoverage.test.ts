import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

// RLS 設定の静的検査（#215 #216 #217）。
// DB には接続せず、schema.prisma / migration / seed.sql のテキストだけを検査する。

const ROOT = path.resolve(__dirname, "../../..");
// Windows の作業コピー（CRLF）でも `--` コメントを除去できるよう \r\n でも分割する
// （`.` は \r にマッチしないため、CRLF の行では /--.*$/ が一致しない）
const stripSqlComments = (sql: string) =>
  sql
    .split(/\r?\n/)
    .map((line) => line.replace(/--.*$/, ""))
    .join("\n");

const schema = fs.readFileSync(path.join(ROOT, "prisma/schema.prisma"), "utf8");
const models = [...schema.matchAll(/^model\s+(\w+)/gm)].map((m) => m[1]);

const migrationsDir = path.join(ROOT, "prisma/migrations");
const migrations = fs
  .readdirSync(migrationsDir)
  .filter((d) => fs.existsSync(path.join(migrationsDir, d, "migration.sql")))
  .sort()
  .map((name) => ({
    name,
    sql: stripSqlComments(
      fs.readFileSync(path.join(migrationsDir, name, "migration.sql"), "utf8"),
    ),
  }));
const allMigrationSql = migrations.map((m) => m.sql).join("\n");

const seedSql = stripSqlComments(
  fs.readFileSync(path.join(ROOT, "supabase/seed.sql"), "utf8"),
);

type PolicyDef = { migration: string; name: string; table: string; body: string };

/** 全 migration を名前順に走査して CREATE POLICY を出現順に集める */
function collectPolicies(): PolicyDef[] {
  const result: PolicyDef[] = [];
  for (const m of migrations) {
    const re = /CREATE\s+POLICY\s+"?(\w+)"?\s+ON\s+(?:public\.)?"?(\w+)"?[\s\S]*?;/gi;
    for (const match of m.sql.matchAll(re)) {
      result.push({ migration: m.name, name: match[1], table: match[2], body: match[0] });
    }
  }
  return result;
}
const policies = collectPolicies();
const latestPolicy = (name: string, table: string) =>
  [...policies].reverse().find((p) => p.name === name && p.table === table);

type FuncDef = { migration: string; name: string; body: string };
function collectFunctions(): FuncDef[] {
  const result: FuncDef[] = [];
  for (const m of migrations) {
    const re =
      /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?"?(\w+)"?[\s\S]*?\$(\w*)\$[\s\S]*?\$\2\$[^;]*;/gi;
    for (const match of m.sql.matchAll(re)) {
      result.push({ migration: m.name, name: match[1], body: match[0] });
    }
  }
  return result;
}
const functions = collectFunctions();
const latestFunction = (name: string) =>
  [...functions].reverse().find((f) => f.name === name);

describe("RLS カバレッジ: 全テーブルで ENABLE ROW LEVEL SECURITY", () => {
  it("schema.prisma からモデルを読み取れている（テスト自体の健全性）", () => {
    expect(models.length).toBeGreaterThanOrEqual(19);
  });

  it("全モデルが migration のいずれかで RLS 有効化されている", () => {
    const missing = models.filter(
      (model) =>
        !new RegExp(
          `ALTER\\s+TABLE\\s+(?:public\\.)?"${model}"\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY`,
          "i",
        ).test(allMigrationSql),
    );
    expect(
      missing,
      `RLS 有効化(ALTER TABLE "<Model>" ENABLE ROW LEVEL SECURITY)が migration に無いテーブル: ${missing.join(", ")}`,
    ).toEqual([]);
  });

  it("_prisma_migrations も RLS 有効化されている", () => {
    expect(
      allMigrationSql,
      "_prisma_migrations の ENABLE ROW LEVEL SECURITY が migration に無い",
    ).toMatch(
      /ALTER\s+TABLE\s+(?:public\.)?"_prisma_migrations"\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i,
    );
  });
});

describe("RLS: User の SELECT ポリシー（子どもに兄弟の行を見せない / #215）", () => {
  it("realtime_select_users が migration で定義されている", () => {
    expect(latestPolicy("realtime_select_users", "User")).toBeDefined();
  });

  it("最新の定義が is_parent() を要求する", () => {
    const p = latestPolicy("realtime_select_users", "User");
    expect(p, "realtime_select_users が migration に無い").toBeDefined();
    expect(
      p!.body,
      `最新定義(${p?.migration})に is_parent() が無い。子どもが同家族の兄弟の User 行(childCode)を読めてしまう`,
    ).toMatch(/is_parent\s*\(\s*\)/i);
  });

  it("自分自身の行は supabaseId = auth.uid() で読める", () => {
    const p = latestPolicy("realtime_select_users", "User");
    expect(p?.body ?? "").toMatch(/"supabaseId"\s*=\s*auth\.uid\(\)/i);
  });

  it("is_parent() 関数が SECURITY DEFINER で定義されている", () => {
    const f = latestFunction("is_parent");
    expect(f, "is_parent() が migration に定義されていない").toBeDefined();
    expect(f!.body).toMatch(/SECURITY\s+DEFINER/i);
    expect(f!.body).toMatch(/'PARENT'/);
  });
});

describe("RLS: BulletinLog / Stamp の SELECT ポリシー（あつまり Realtime / #216）", () => {
  for (const table of ["BulletinLog", "Stamp"]) {
    it(`${table} に SELECT ポリシーがあり can_view_gathering_group を使う`, () => {
      const selects = policies.filter(
        (p) => p.table === table && /FOR\s+SELECT/i.test(p.body),
      );
      expect(
        selects.length,
        `${table} に FOR SELECT の CREATE POLICY が無い（Realtime が配信されない）`,
      ).toBeGreaterThan(0);
      const last = selects[selects.length - 1];
      expect(
        last.body,
        `${table} の SELECT ポリシー(${last.name})が can_view_gathering_group を使っていない`,
      ).toMatch(/can_view_gathering_group\s*\(/i);
    });
  }

  it("can_view_gathering_group が GatheringMember を参照する", () => {
    const f = latestFunction("can_view_gathering_group");
    expect(f, "can_view_gathering_group が migration に定義されていない").toBeDefined();
    expect(f!.body).toMatch(/"?GatheringMember"?/);
    expect(f!.body).toMatch(/SECURITY\s+DEFINER/i);
  });
});

describe("RLS: SECURITY DEFINER 関数の安全性（#217）", () => {
  it("migration 内に SECURITY DEFINER 関数が存在する", () => {
    expect(
      functions.filter((f) => /SECURITY\s+DEFINER/i.test(f.body)).length,
    ).toBeGreaterThan(0);
  });

  it("すべての SECURITY DEFINER 関数の最新定義に SET search_path がある", () => {
    // 適用済み migration は書き換えられないため、CREATE OR REPLACE で上書きされた最新定義だけを検査する
    const latestDefs = [...new Set(functions.map((f) => f.name))].map(
      (n) => latestFunction(n)!,
    );
    const bad = latestDefs
      .filter((f) => /SECURITY\s+DEFINER/i.test(f.body))
      .filter((f) => !/SET\s+search_path\s*(=|TO)/i.test(f.body))
      .map((f) => `${f.name} (${f.migration})`);
    expect(bad, `SET search_path が無い SECURITY DEFINER 関数: ${bad.join(", ")}`).toEqual([]);
  });

  it("各関数に REVOKE EXECUTE（PUBLIC）がある", () => {
    const names = [
      "is_same_family",
      "get_my_family_id",
      "get_my_user_id",
      "is_parent",
      "can_view_gathering_group",
    ];
    const missing = names.filter(
      (n) =>
        !new RegExp(
          `REVOKE\\s+EXECUTE\\s+ON\\s+FUNCTION\\s+(?:public\\.)?${n}\\b`,
          "i",
        ).test(allMigrationSql),
    );
    expect(missing, `REVOKE EXECUTE が無い関数: ${missing.join(", ")}`).toEqual([]);
  });
});

describe("RLS: ポリシー定義の収束（DROP POLICY IF EXISTS を伴う）", () => {
  const managed = [
    ["realtime_select_quests", "QuestInstance"],
    ["realtime_select_tasks", "TaskTemplate"],
    ["realtime_select_treasure_logs", "TreasureLog"],
    ["realtime_select_users", "User"],
    ["realtime_select_badges", "UserBadge"],
  ] as const;

  it("管理対象の既存5ポリシーが migration に存在する", () => {
    const missing = managed
      .filter(([n, t]) => !latestPolicy(n, t))
      .map(([n, t]) => `${n} ON ${t}`);
    expect(missing, `migration に無いポリシー: ${missing.join(", ")}`).toEqual([]);
  });

  it("各ポリシーの最新定義 migration に DROP POLICY IF EXISTS がある", () => {
    const targets = [
      ...managed.map(([n, t]) => ({ name: n, table: t as string })),
      ...policies
        .filter((p) => p.table === "BulletinLog" || p.table === "Stamp")
        .map((p) => ({ name: p.name, table: p.table })),
    ];
    // BulletinLog / Stamp のポリシーが 1 件も無い場合は上のテストで検出されるが、ここでも明示する
    expect(
      targets.length,
      "BulletinLog / Stamp のポリシーが migration に無い",
    ).toBeGreaterThan(managed.length);

    const bad: string[] = [];
    for (const { name, table } of targets) {
      const latest = latestPolicy(name, table);
      if (!latest) continue;
      const sql = migrations.find((m) => m.name === latest.migration)!.sql;
      const re = new RegExp(
        `DROP\\s+POLICY\\s+IF\\s+EXISTS\\s+"?${name}"?\\s+ON\\s+(?:public\\.)?"?${table}"?`,
        "i",
      );
      if (!re.test(sql)) bad.push(`${name} ON ${table} (${latest.migration})`);
    }
    expect(bad, `DROP POLICY IF EXISTS を伴わないポリシー: ${bad.join(", ")}`).toEqual([]);
  });
});

describe("supabase/seed.sql: RLS 定義は migration に一本化（二重管理しない）", () => {
  it("public テーブルへの CREATE POLICY が残っていない", () => {
    const remaining = models.filter((model) =>
      new RegExp(`CREATE\\s+POLICY[\\s\\S]*?ON\\s+(?:public\\.)?"${model}"`, "i").test(seedSql),
    );
    expect(
      remaining,
      `seed.sql に残っているポリシー定義(対象テーブル): ${remaining.join(", ")}`,
    ).toEqual([]);
  });

  it("public テーブルの ENABLE ROW LEVEL SECURITY が残っていない", () => {
    const remaining = models.filter((model) =>
      new RegExp(`ALTER\\s+TABLE\\s+(?:public\\.)?"${model}"\\s+ENABLE\\s+ROW`, "i").test(seedSql),
    );
    expect(remaining, `seed.sql に残っている RLS 有効化: ${remaining.join(", ")}`).toEqual([]);
  });

  it("SECURITY DEFINER 関数の定義が残っていない", () => {
    expect(seedSql).not.toMatch(/SECURITY\s+DEFINER/i);
  });

  it("storage.objects のポリシーと publication は残っている", () => {
    expect(seedSql).toMatch(/storage\.objects/i);
    expect(seedSql).toMatch(/supabase_realtime/i);
  });
});

describe("テストヘルパーの境界: SQL コメントの除去", () => {
  it("-- コメント中の文字列は照合対象にならない", () => {
    expect(stripSqlComments("-- ENABLE ROW LEVEL SECURITY\nSELECT 1;")).not.toMatch(/ROW LEVEL/);
  });
});
