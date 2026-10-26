import { describe, it, expect, vi } from "vitest";

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(),
}));

import { config } from "@/proxy";

// Next.js の matcher は正規表現としてパスに適用される。
// /api/* は各 Route Handler の getCurrentUser() が認証するため、ミドルウェアでの
// 認証往復（とトークン更新の並列衝突）を避けて対象外にする（Issue #206 Step 2）。
function matches(path: string): boolean {
  return config.matcher.some((m) => new RegExp(`^${m}$`).test(path));
}

describe("proxy matcher", () => {
  it.each(["/api/tasks", "/api/quests/today", "/api/approve/abc/", "/api/cron/auto-approve"])(
    "%s はミドルウェアの対象外",
    (path) => {
      expect(matches(path)).toBe(false);
    },
  );

  it.each(["/", "/login", "/app/parent/tasks", "/app/child/quests", "/app/register", "/apis-like-page"])(
    "%s はミドルウェアの対象",
    (path) => {
      expect(matches(path)).toBe(true);
    },
  );

  it.each(["/_next/static/chunk.js", "/favicon.ico", "/sw.js", "/manifest.json", "/icon-192.png"])(
    "%s は従来どおり対象外",
    (path) => {
      expect(matches(path)).toBe(false);
    },
  );
});
