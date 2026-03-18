import { describe, it, expect, vi, beforeEach } from "vitest";

// We need to mock createServerClient before importing the module
vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(),
}));

import { updateSession } from "@/lib/supabase/middleware";
import { createServerClient } from "@supabase/ssr";
import { NextRequest } from "next/server";

const mockCreateServerClient = vi.mocked(createServerClient);

function makeRequest(pathname: string): NextRequest {
  return new NextRequest(new URL(`http://localhost${pathname}`));
}

function mockSupabaseAuth(
  user: { id: string; email?: string; is_anonymous?: boolean } | null
) {
  mockCreateServerClient.mockReturnValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user } }),
    },
  } as any);
}

const parentUser = { id: "parent-1", email: "parent@example.com", is_anonymous: false };
const childUser = { id: "child-1", is_anonymous: true };

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
      expect(res.status).not.toBe(307);
    });
  });

  describe("Public routes (unauthenticated)", () => {
    it.each(["/login", "/register", "/child/onboarding"])(
      "%s は未認証でもアクセス可能であること",
      async (route) => {
        mockSupabaseAuth(null);
        const res = await updateSession(makeRequest(route));
        expect(res.status).not.toBe(307);
      }
    );

    it("末尾スラッシュ付きでもパブリックルートとして扱うこと", async () => {
      mockSupabaseAuth(null);
      const res = await updateSession(makeRequest("/login/"));
      expect(res.status).not.toBe(307);
    });
  });

  describe("Protected routes (unauthenticated)", () => {
    it("/parent/* に未認証でアクセスすると /login にリダイレクトすること", async () => {
      mockSupabaseAuth(null);
      const res = await updateSession(makeRequest("/parent/tasks"));
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/login");
    });

    it("/child/* に未認証でアクセスすると / にリダイレクトすること", async () => {
      mockSupabaseAuth(null);
      const res = await updateSession(makeRequest("/child/quests"));
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toMatch(/\/$/);
      expect(res.headers.get("location")).not.toContain("/login");
    });
  });

  describe("TOP page (/) role-based redirect", () => {
    it("子アカウントでログイン済みの場合 /child/quests にリダイレクトすること", async () => {
      mockSupabaseAuth(childUser);
      const res = await updateSession(makeRequest("/"));
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/child/quests");
    });

    it("親アカウントでログイン済みの場合 /parent/tasks にリダイレクトすること", async () => {
      mockSupabaseAuth(parentUser);
      const res = await updateSession(makeRequest("/"));
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/parent/tasks");
    });

    it("未認証の場合 / をそのまま表示すること", async () => {
      mockSupabaseAuth(null);
      const res = await updateSession(makeRequest("/"));
      expect(res.status).not.toBe(307);
    });
  });

  describe("Role protection (authenticated)", () => {
    it("子アカウントが /parent/* にアクセスすると /child/quests にリダイレクトすること", async () => {
      mockSupabaseAuth(childUser);
      const res = await updateSession(makeRequest("/parent/tasks"));
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/child/quests");
    });

    it("子アカウントが /parent/approve にアクセスしても /child/quests にリダイレクトすること", async () => {
      mockSupabaseAuth(childUser);
      const res = await updateSession(makeRequest("/parent/approve"));
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/child/quests");
    });

    it("親アカウントが /child/* にアクセスすると /parent/tasks にリダイレクトすること", async () => {
      mockSupabaseAuth(parentUser);
      const res = await updateSession(makeRequest("/child/quests"));
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/parent/tasks");
    });

    it("親アカウントが /child/monster にアクセスしても /parent/tasks にリダイレクトすること", async () => {
      mockSupabaseAuth(parentUser);
      const res = await updateSession(makeRequest("/child/monster"));
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/parent/tasks");
    });

    it("親アカウントが /parent/tasks に正常にアクセスできること", async () => {
      mockSupabaseAuth(parentUser);
      const res = await updateSession(makeRequest("/parent/tasks"));
      expect(res.status).not.toBe(307);
    });

    it("子アカウントが /child/quests に正常にアクセスできること", async () => {
      mockSupabaseAuth(childUser);
      const res = await updateSession(makeRequest("/child/quests"));
      expect(res.status).not.toBe(307);
    });

    it("認証済みユーザーが /login にアクセスしてもリダイレクトしないこと", async () => {
      mockSupabaseAuth(parentUser);
      const res = await updateSession(makeRequest("/login"));
      expect(res.status).not.toBe(307);
    });

    it("認証済みユーザーが /register にアクセスしてもリダイレクトしないこと", async () => {
      mockSupabaseAuth(parentUser);
      const res = await updateSession(makeRequest("/register"));
      expect(res.status).not.toBe(307);
    });
  });
});
