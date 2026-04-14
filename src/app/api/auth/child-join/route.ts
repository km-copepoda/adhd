import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { generateChildCode } from "@/lib/categories";
import { routeLogger } from "@/lib/logger";

export async function POST(request: Request) {
  const rlog = routeLogger("POST", "/api/auth/child-join");
  const { monsterName, side, familyCode } = await request.json();
  const supabase = await createClient();

  // Check if already authenticated
  let { data: { user } } = await supabase.auth.getUser();

  // If not, sign in anonymously
  if (!user) {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error || !data.user) {
      return NextResponse.json({ error: "認証に失敗しました" }, { status: 400 });
    }
    user = data.user;
  }

  // Find or skip family
  let familyId: string | null = null;
  if (familyCode) {
    const family = await prisma.family.findUnique({ where: { code: familyCode.toUpperCase() } });
    if (!family) {
      rlog.warn("Family not found", { familyCode: "***" });
      return NextResponse.json({ error: "ファミリーコードが見つかりません" }, { status: 404 });
    }
    familyId = family.id;
  }

  // Generate unique child code within the family
  let childCode: string | null = null;
  if (familyId) {
    // Try up to 10 times to generate a unique code
    for (let i = 0; i < 10; i++) {
      const candidate = generateChildCode();
      const existing = await prisma.user.findUnique({
        where: { familyId_childCode: { familyId, childCode: candidate } },
      });
      if (!existing) {
        childCode = candidate;
        break;
      }
    }
    if (!childCode) {
      childCode = generateChildCode() + generateChildCode().slice(0, 2); // Fallback: 6 digits
    }
  }

  // Create or update child user
  const dbUser = await prisma.user.upsert({
    where: { supabaseId: user.id },
    update: { monsterName, side, familyId, childCode },
    create: {
      supabaseId: user.id,
      role: "CHILD",
      monsterName,
      side,
      familyId,
      childCode,
    },
  });

  rlog.info("Child joined", { childId: dbUser.id, familyId: familyId ?? undefined, side });
  return NextResponse.json({ userId: dbUser.id, childCode: dbUser.childCode });
}
