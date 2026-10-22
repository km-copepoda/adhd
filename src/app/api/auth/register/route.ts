import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { generateFamilyCode } from "@/lib/categories";
import { routeLogger } from "@/lib/logger";

export async function POST(request: Request) {
  const rlog = routeLogger("POST", "/api/auth/register");

  // body は任意（空 body は許容）だが、JSON として不正なものは 400。
  // body の内容（supabaseId / email）は信用しないため、値としては使わない。
  const text = await request.text();
  if (text.trim() !== "") {
    try {
      JSON.parse(text);
    } catch {
      return NextResponse.json({ error: "リクエストが不正です" }, { status: 400 });
    }
  }

  // ユーザーはサーバーで JWT 検証した結果のみを使う
  const supabase = await createClient();
  // signUp 直後は cookie が未反映のことがあるため、Authorization の Bearer トークンがあれば
  // それを Supabase に検証させて使う（検証はサーバー側 getUser(jwt) で行う）
  const authHeader = request.headers.get("authorization");
  const bearer = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1];
  const { data: { user } } = bearer
    ? await supabase.auth.getUser(bearer)
    : await supabase.auth.getUser();

  if (!user) {
    rlog.warn("Registration failed: unauthenticated");
    return NextResponse.json({ error: "認証に失敗しました" }, { status: 401 });
  }

  // email のない匿名ユーザー（子供セッション）は親として登録させない
  if (!user.email) {
    rlog.warn("Registration rejected: anonymous user", { userId: user.id });
    return NextResponse.json({ error: "メールアドレス登録が必要です" }, { status: 403 });
  }

  const userId = user.id;

  // Check if user already exists in DB
  const existing = await prisma.user.findUnique({ where: { supabaseId: userId } });
  if (existing) {
    rlog.info("Existing user returned", { userId, familyId: existing.familyId });
    return NextResponse.json({ familyId: existing.familyId });
  }

  // Create family + parent user
  const family = await prisma.family.create({
    data: {
      code: generateFamilyCode(),
      users: {
        create: {
          supabaseId: userId,
          role: "PARENT",
          name: user.email.split("@")[0] || "parent",
        },
      },
    },
  });

  rlog.info("Registration success", { userId, familyId: family.id });
  return NextResponse.json({ familyId: family.id, code: family.code });
}
