import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { generateFamilyCode } from "@/lib/categories";
import { log } from "@/lib/logger";

export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user ?? null;
  if (!user) return null;

  const dbUser = await prisma.user.findUnique({
    where: { supabaseId: user.id },
    include: { family: true },
  });

  // DB リセット後などで Supabase セッションは有効だが DB ユーザーが存在しない場合に再作成
  if (!dbUser && user.email) {
    log.warn("DB user missing, auto-recreating", { supabaseId: user.id });
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
    return prisma.user.findUnique({
      where: { supabaseId: user.id },
      include: { family: true },
    });
  }

  return dbUser;
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
