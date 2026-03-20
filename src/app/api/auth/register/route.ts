import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { generateFamilyCode } from "@/lib/constants";
import { routeLogger } from "@/lib/logger";

export async function POST(request: Request) {
  const rlog = routeLogger("POST", "/api/auth/register");
  const { email, supabaseId } = await request.json();

  // supabaseIdはクライアント側signUp()のレスポンスから渡される
  // セッションcookieが間に合わない場合のフォールバックとしてリクエストbodyから取得
  let userId = supabaseId;
  if (!userId) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    userId = user?.id;
  }

  if (!userId) {
    rlog.warn("Registration failed: no userId");
    return NextResponse.json({ error: "認証に失敗しました" }, { status: 401 });
  }

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
          name: email?.split("@")[0] || "parent",
        },
      },
    },
  });

  rlog.info("Registration success", { userId, familyId: family.id });
  return NextResponse.json({ familyId: family.id, code: family.code });
}
