import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

// service role を扱う admin クライアントとその利用側 (accountCleanup) が
// クライアントバンドルに入らないことの静的検査（#235）。`server-only` パッケージは導入しない方針。

const ROOT = path.resolve(__dirname, "../../..");
const SRC = path.join(ROOT, "src");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__tests__" || entry.name === "generated" || entry.name === "node_modules") continue;
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

const files = walk(SRC).map((f) => ({
  rel: path.relative(ROOT, f).replace(/\\/g, "/"),
  text: fs.readFileSync(f, "utf8"),
}));

const isClient = (text: string) => /^\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*["']use client["']/.test(text);
const importsModule = (text: string, spec: string) =>
  new RegExp(`(?:from|import)\\s*\\(?\\s*["']${spec.replace(/[/]/g, "\\/")}(?:\\.ts)?["']`).test(text);

describe("クライアントバンドルに入れてはいけないモジュール", () => {
  it("テスト自体の健全性: use client ファイルを検出できる", () => {
    expect(files.filter((f) => isClient(f.text)).length).toBeGreaterThan(0);
  });

  it('"use client" のファイルが @/lib/supabase/admin を import していない', () => {
    const bad = files.filter((f) => isClient(f.text) && importsModule(f.text, "@/lib/supabase/admin"));
    expect(bad.map((f) => f.rel)).toEqual([]);
  });

  it('"use client" のファイルが @/lib/accountCleanup を import していない', () => {
    const bad = files.filter((f) => isClient(f.text) && importsModule(f.text, "@/lib/accountCleanup"));
    expect(bad.map((f) => f.rel)).toEqual([]);
  });

  it('"use client" のファイルが @/lib/accountCleanupJob を import していない', () => {
    const bad = files.filter((f) => isClient(f.text) && importsModule(f.text, "@/lib/accountCleanupJob"));
    expect(bad.map((f) => f.rel)).toEqual([]);
  });

  it("src/lib/accountCleanupJob.ts は admin クライアントを直接 import せず、accountCleanup 経由で使う", () => {
    const f = files.find((x) => x.rel === "src/lib/accountCleanupJob.ts");
    expect(f, "src/lib/accountCleanupJob.ts が無い").toBeDefined();
    expect(importsModule(f!.text, "@/lib/supabase/admin")).toBe(false);
    expect(importsModule(f!.text, "@/lib/accountCleanup")).toBe(true);
  });

  it("@/lib/supabase/admin を import するのは src/lib/accountCleanup.ts だけ", () => {
    const importers = files
      .filter((f) => f.rel !== "src/lib/supabase/admin.ts" && importsModule(f.text, "@/lib/supabase/admin"))
      .map((f) => f.rel);
    expect(importers).toEqual(["src/lib/accountCleanup.ts"]);
  });

  it("src/lib/accountDeletion.ts（DB 操作）は admin クライアント / accountCleanup を import しない（責務分離）", () => {
    const f = files.find((x) => x.rel === "src/lib/accountDeletion.ts");
    expect(f, "src/lib/accountDeletion.ts が無い").toBeDefined();
    expect(importsModule(f!.text, "@/lib/supabase/admin")).toBe(false);
    expect(importsModule(f!.text, "@/lib/accountCleanup")).toBe(false);
  });

  it("admin.ts は SUPABASE_SERVICE_ROLE_KEY を読み、NEXT_PUBLIC_ 接頭辞を付けない", () => {
    const f = files.find((x) => x.rel === "src/lib/supabase/admin.ts");
    expect(f, "src/lib/supabase/admin.ts が無い").toBeDefined();
    expect(f!.text).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(f!.text).not.toContain("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY");
    expect(isClient(f!.text)).toBe(false);
  });

  it("isClient / importsModule ヘルパーの境界: コメントや文字列だけの言及は import と見なさない", () => {
    expect(importsModule('// see @/lib/supabase/admin\nconst x = 1;', "@/lib/supabase/admin")).toBe(false);
    expect(importsModule('import { a } from "@/lib/supabase/admin";', "@/lib/supabase/admin")).toBe(true);
    expect(isClient('"use client";\nimport x from "y";')).toBe(true);
    expect(isClient('import x from "y";\n"use client";')).toBe(false);
  });
});
