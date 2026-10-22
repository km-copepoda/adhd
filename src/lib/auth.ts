import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { generateFamilyCode } from "@/lib/categories";
import { log } from "@/lib/logger";
import { isUniqueViolation } from "@/lib/prismaErrors";

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
  const user = { id: claims.sub, email: typeof claims.email === "string" ? claims.email : undefined };

  const find = () =>
    prisma.user.findUnique({
      where: { supabaseId: user.id },
      include: { family: true },
    });

  const dbUser = await find();
  if (dbUser || !user.email) return dbUser;

  // DB リセット後などで Supabase セッションは有効だが DB ユーザーが存在しない場合に再作成
  log.warn("DB user missing, auto-recreating", { supabaseId: user.id });
  for (let attempt = 0; attempt < RECREATE_MAX_ATTEMPTS; attempt++) {
    try {
      await prisma.family.create({
        data: {
          code: generateFamilyCode(),
          users: {
            create: {
              supabaseId: user.id,
              role: "PARENT",
              name: user.email.split("@")[0],
            },
          },
        },
      });
      return find();
    } catch (e) {
      if (!isUniqueViolation(e)) throw e;
      // 並列リクエストが先に作成した場合は再取得、家族コード衝突なら再試行
      const existing = await find();
      if (existing) return existing;
    }
  }
  throw new Error("Failed to auto-recreate user");
}

const RECREATE_MAX_ATTEMPTS = 5;

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
