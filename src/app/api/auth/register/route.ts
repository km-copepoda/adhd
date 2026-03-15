import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { generateFamilyCode } from "@/lib/constants";

export async function POST(request: Request) {
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
    return NextResponse.json({ error: "認証に失敗しました" }, { status: 401 });
  }

  // Check if user already exists in DB
  const existing = await prisma.user.findUnique({ where: { supabaseId: userId } });
  if (existing) {
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

  return NextResponse.json({ familyId: family.id, code: family.code });
}
