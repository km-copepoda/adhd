import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ALL_BADGES, checkAndUnlockBadges } from "@/lib/badges";

/**
 * GET /api/badges
 * 子供の全バッジ情報（解除済み＋未解除）を返す。
 * 呼び出し時に新たに解除されたバッジがあれば DB に保存する。
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "CHILD") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  // 新規バッジ解除チェック（ページロード時に自動実行）
  const newlyUnlocked = await checkAndUnlockBadges(user.id);

  // 解除済みバッジ一覧を取得
  const unlockedRecords = await prisma.userBadge.findMany({
    where: { userId: user.id },
    select: { badgeId: true, unlockedAt: true },
    orderBy: { unlockedAt: "desc" },
  });

  const unlockedMap = new Map(unlockedRecords.map(r => [r.badgeId, r.unlockedAt]));

  const badges = ALL_BADGES.map(badge => ({
    ...badge,
    unlocked: unlockedMap.has(badge.id),
    unlockedAt: unlockedMap.get(badge.id) ?? null,
    isNew: newlyUnlocked.some(b => b.id === badge.id),
  }));

  return NextResponse.json({
    badges,
    unlockedCount: unlockedMap.size,
    totalCount: ALL_BADGES.length,
    newlyUnlocked: newlyUnlocked.map(b => b.id),
  });
}
