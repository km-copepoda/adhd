/**
 * Supabase 認証モック用ヘルパー
 */
import { vi } from "vitest";
import { createClient } from "@/lib/supabase/server";

const mockCreateClient = vi.mocked(createClient);

/** supabase.auth.getUser() が返すユーザーをモックする */
export function mockSupabaseUser(user: { id: string; email?: string } | null) {
  mockCreateClient.mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user } }),
    },
  } as any);
}

/** 匿名サインイン付きの Supabase モック（child-join 用） */
export function mockSupabaseWithAnonymous(
  existingUser: { id: string } | null,
  anonymousResult: { id: string } | null,
) {
  mockCreateClient.mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: existingUser } }),
      signInAnonymously: vi.fn().mockResolvedValue(
        anonymousResult
          ? { data: { user: anonymousResult }, error: null }
          : { data: { user: null }, error: { message: "failed" } },
      ),
    },
  } as any);
}

/** パスワード認証の Supabase モック（login 用） */
export function mockSupabaseSignIn(
  result: { user: Record<string, unknown> } | null,
  error: { message: string } | null = null,
) {
  mockCreateClient.mockResolvedValue({
    auth: {
      signInWithPassword: vi.fn().mockResolvedValue({
        data: result ?? { user: null },
        error,
      }),
    },
  } as any);
}
