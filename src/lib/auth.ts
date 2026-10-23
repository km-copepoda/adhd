import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function getCurrentUser() {
  const supabase = await createClient();
  // getSession はサーバーで JWT を検証しないため、認可には getClaims を使う。getClaims は署名を
  // 検証し（非対称鍵ならローカル検証で Auth への往復なし、HS256 なら内部で getUser にフォールバック）、
  // 期限切れ時のトークン更新も内部の getSession 経由で行う。
  // 壊れた JWT クッキーなどでは error を返さず例外を投げるため、それも未認証として扱う
  const { data, error } = await supabase.auth
    .getClaims()
    .catch(() => ({ data: null, error: true as const }));
  const claims = data?.claims;
  if (error || !claims?.sub) return null;

  // DB に User が無い（退会済み・DB リセット後）場合は null。ここで自動再作成すると退会者が復活する
  return prisma.user.findUnique({
    where: { supabaseId: claims.sub },
    include: { family: true },
  });
}

export type AuthUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

export class AuthError extends Error {
  constructor(public message: string, public status: number) {
    super(message);
  }
}

/**
 * 認証済みユーザーを取得する。未認証またはロール不一致の場合は AuthError をスローする。
 * try/catch で `AuthError` を捕捉し NextResponse.json を返す想定。
 */
export async function requireUser(role?: "PARENT" | "CHILD"): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("認証が必要です", 401);
  if (role && user.role !== role) throw new AuthError("権限がありません", 403);
  return user;
}
