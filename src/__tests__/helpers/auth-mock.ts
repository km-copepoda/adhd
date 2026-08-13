/**
 * Supabase 認証モック用ヘルパー
 */
import { vi } from "vitest";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

const mockCreateClient = vi.mocked(createClient);

/**
 * `SupabaseClient` は多数のプロパティ（`auth`/`storage`/`realtime` 等）を持つ大きな型で、
 * テストで使うのは `auth` の一部メソッドのみ。完全なモックを作るコストに見合わないため、
 * 呼び出し側が必要とする部分だけを持つオブジェクトを `as unknown as SupabaseClient` で
 * 表現する（実行時の挙動は変えない、型のみのキャスト）。
 */
function asSupabaseClient(auth: Record<string, unknown>): SupabaseClient {
  return { auth } as unknown as SupabaseClient;
}

/** supabase.auth.getUser() が返すユーザーをモックする */
export function mockSupabaseUser(user: { id: string; email?: string } | null) {
  mockCreateClient.mockResolvedValue(
    asSupabaseClient({
      getUser: vi.fn().mockResolvedValue({ data: { user } }),
    }),
  );
}

/** 匿名サインイン付きの Supabase モック（child-join 用） */
export function mockSupabaseWithAnonymous(
  existingUser: { id: string } | null,
  anonymousResult: { id: string } | null,
) {
  mockCreateClient.mockResolvedValue(
    asSupabaseClient({
      getUser: vi.fn().mockResolvedValue({ data: { user: existingUser } }),
      signInAnonymously: vi.fn().mockResolvedValue(
        anonymousResult
          ? { data: { user: anonymousResult }, error: null }
          : { data: { user: null }, error: { message: "failed" } },
      ),
    }),
  );
}

/** パスワード認証の Supabase モック（login 用） */
export function mockSupabaseSignIn(
  result: { user: Record<string, unknown> } | null,
  error: { message: string } | null = null,
) {
  mockCreateClient.mockResolvedValue(
    asSupabaseClient({
      signInWithPassword: vi.fn().mockResolvedValue({
        data: result ?? { user: null },
        error,
      }),
    }),
  );
}
