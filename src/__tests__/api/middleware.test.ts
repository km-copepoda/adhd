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
    it.each(["/", "/login", "/app/parent/login", "/app/register", "/app/child/login"])(
      "%s は未認証でもアクセス可能であること",
      async (route) => {
        mockSupabaseAuth(null);
        const res = await updateSession(makeRequest(route));
        expect(res.status).not.toBe(307);
      }
    );

    it("末尾スラッシュ付きでもパブリックルートとして扱うこと", async () => {
      mockSupabaseAuth(null);
      const res = await updateSession(makeRequest("/app/parent/login/"));
      expect(res.status).not.toBe(307);
    });
  });

  describe("Protected routes (unauthenticated)", () => {
    it("/app/parent/* に未認証でアクセスすると /app/parent/login にリダイレクトすること", async () => {
      mockSupabaseAuth(null);
      const res = await updateSession(makeRequest("/app/parent/tasks"));
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/app/parent/login");
    });

    it("/app/child/* に未認証でアクセスすると /login にリダイレクトすること", async () => {
      mockSupabaseAuth(null);
      const res = await updateSession(makeRequest("/app/child/quests"));
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/login");
    });
  });

  describe("/login page role-based redirect", () => {
    it("子アカウントでログイン済みの場合 /app/child/quests にリダイレクトすること", async () => {
      mockSupabaseAuth(childUser);
      const res = await updateSession(makeRequest("/login"));
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/app/child/quests");
    });

    it("親アカウントでログイン済みの場合 /app/parent/tasks にリダイレクトすること", async () => {
      mockSupabaseAuth(parentUser);
      const res = await updateSession(makeRequest("/login"));
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/app/parent/tasks");
    });

    it("未認証の場合 /login をそのまま表示すること", async () => {
      mockSupabaseAuth(null);
      const res = await updateSession(makeRequest("/login"));
      expect(res.status).not.toBe(307);
    });
  });

  describe("LP page (/) - always accessible", () => {
    it("未認証でも / にアクセスできること", async () => {
      mockSupabaseAuth(null);
      const res = await updateSession(makeRequest("/"));
      expect(res.status).not.toBe(307);
    });

    it("子アカウントでログイン済みでも / をそのまま表示すること", async () => {
      mockSupabaseAuth(childUser);
      const res = await updateSession(makeRequest("/"));
      expect(res.status).not.toBe(307);
    });

    it("親アカウントでログイン済みでも / をそのまま表示すること", async () => {
      mockSupabaseAuth(parentUser);
      const res = await updateSession(makeRequest("/"));
      expect(res.status).not.toBe(307);
    });
  });

  describe("Role protection (authenticated)", () => {
    it("子アカウントが /app/parent/* にアクセスすると /app/child/quests にリダイレクトすること", async () => {
      mockSupabaseAuth(childUser);
      const res = await updateSession(makeRequest("/app/parent/tasks"));
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/app/child/quests");
    });

    it("子アカウントが /app/parent/approve にアクセスしても /app/child/quests にリダイレクトすること", async () => {
      mockSupabaseAuth(childUser);
      const res = await updateSession(makeRequest("/app/parent/approve"));
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/app/child/quests");
    });

    it("親アカウントが /app/child/* にアクセスすると /app/parent/tasks にリダイレクトすること", async () => {
      mockSupabaseAuth(parentUser);
      const res = await updateSession(makeRequest("/app/child/quests"));
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/app/parent/tasks");
    });

    it("親アカウントが /app/child/monster にアクセスしても /app/parent/tasks にリダイレクトすること", async () => {
      mockSupabaseAuth(parentUser);
      const res = await updateSession(makeRequest("/app/child/monster"));
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/app/parent/tasks");
    });

    it("親アカウントが /app/parent/tasks に正常にアクセスできること", async () => {
      mockSupabaseAuth(parentUser);
      const res = await updateSession(makeRequest("/app/parent/tasks"));
      expect(res.status).not.toBe(307);
    });

    it("子アカウントが /app/child/quests に正常にアクセスできること", async () => {
      mockSupabaseAuth(childUser);
      const res = await updateSession(makeRequest("/app/child/quests"));
      expect(res.status).not.toBe(307);
    });

    it("認証済みユーザーが /app/parent/login にアクセスしてもリダイレクトしないこと", async () => {
      mockSupabaseAuth(parentUser);
      const res = await updateSession(makeRequest("/app/parent/login"));
      expect(res.status).not.toBe(307);
    });

    it("認証済みユーザーが /app/register にアクセスしてもリダイレクトしないこと", async () => {
      mockSupabaseAuth(parentUser);
      const res = await updateSession(makeRequest("/app/register"));
      expect(res.status).not.toBe(307);
    });
  });
});
