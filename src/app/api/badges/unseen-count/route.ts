import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/badges/unseen-count
 * 子供の解除済みバッジ件数のみを返す軽量エンドポイント。
 * checkAndUnlockBadges は呼び出さない（approve.ts で実施済み）。
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "CHILD") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const count = await prisma.userBadge.count({
    where: { userId: user.id },
  });

  return NextResponse.json({ unlockedCount: count });
}
