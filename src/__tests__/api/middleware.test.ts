import { describe, it, expect, vi, beforeEach } from "vitest";

// We need to mock createServerClient before importing the module
vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(),
}));

import { updateSession } from "@/lib/supabase/middleware";
import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

const mockCreateServerClient = vi.mocked(createServerClient);

function makeRequest(pathname: string): NextRequest {
  return new NextRequest(new URL(`http://localhost${pathname}`));
}

function mockSupabaseAuth(user: { id: string } | null) {
  mockCreateServerClient.mockReturnValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user } }),
    },
  } as any);
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
});

describe("updateSession (middleware)", () => {
  describe("API routes", () => {
    it("APIルートは認証チェックをスキップすること", async () => {
      mockSupabaseAuth(null);
      const res = await updateSession(makeRequest("/api/tasks"));
      // Should not redirect
      expect(res.status).not.toBe(307);
    });
  });

  describe("Public routes", () => {
    it.each(["/", "/parent/login", "/register", "/child/login"])(
      "%s は未認証でもアクセス可能であること",
      async (route) => {
        mockSupabaseAuth(null);
        const res = await updateSession(makeRequest(route));
        expect(res.status).not.toBe(307);
      }
    );

    it("末尾スラッシュ付きでもパブリックルートとして扱うこと", async () => {
      mockSupabaseAuth(null);
      const res = await updateSession(makeRequest("/parent/login/"));
      expect(res.status).not.toBe(307);
    });
  });

  describe("Protected routes (unauthenticated)", () => {
    it("/parent/* に未認証でアクセスすると /parent/login にリダイレクトすること", async () => {
      mockSupabaseAuth(null);
      const res = await updateSession(makeRequest("/parent/tasks"));
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/parent/login");
    });

    it("/child/* に未認証でアクセスすると / にリダイレクトすること", async () => {
      mockSupabaseAuth(null);
      const res = await updateSession(makeRequest("/child/quests"));
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/");
      // Should NOT redirect to /login for child routes
      expect(res.headers.get("location")).not.toContain("/login");
    });
  });

  describe("Authenticated redirects", () => {
    it("認証済みユーザーが /parent/login にアクセスしてもリダイレクトしないこと（ロールチェックはlayoutに委譲）", async () => {
      mockSupabaseAuth({ id: "user-1" });
      const res = await updateSession(makeRequest("/parent/login"));
      expect(res.status).not.toBe(307);
    });

    it("認証済みユーザーが /register にアクセスしてもリダイレクトしないこと", async () => {
      mockSupabaseAuth({ id: "user-1" });
      const res = await updateSession(makeRequest("/register"));
      expect(res.status).not.toBe(307);
    });

    it("認証済みユーザーが保護ルートに正常にアクセスできること", async () => {
      mockSupabaseAuth({ id: "user-1" });
      const res = await updateSession(makeRequest("/parent/tasks"));
      expect(res.status).not.toBe(307);
    });
  });
});
