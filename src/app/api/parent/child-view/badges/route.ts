// 親代理（子供モード）— 子供の実績（バッジ）一覧を取得する。
//
// GET /api/parent/child-view/badges?childId=X
// /api/badges を子供セルフ用に残したまま、親モード経路として並走させる。
// 親が代理で操作したクエスト経由の解除も captureAndUnlockBadges で取りこぼさない。

import { NextResponse, after } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ALL_BADGES, checkAndUnlockBadges } from "@/lib/badges";
import { triggerBadgeLog } from "@/lib/bulletinLog";
import { resolveTargetChild } from "@/lib/parentChildView";

export async function GET(request: Request) {
  const parent = await getCurrentUser();
  if (!parent) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const url = new URL(request.url);
  const childId = url.searchParams.get("childId");
  const resolved = await resolveTargetChild(parent, childId);
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }
  const child = resolved.child;

  const newlyUnlocked = await checkAndUnlockBadges(child.id);

  if (newlyUnlocked.length > 0) {
    after(() => {
      for (const badge of newlyUnlocked) {
        triggerBadgeLog(child.id, badge.name).catch(() => {});
      }
    });
  }

  const unlockedRecords = await prisma.userBadge.findMany({
    where: { userId: child.id },
    select: { badgeId: true, unlockedAt: true },
    orderBy: { unlockedAt: "desc" },
  });

  const unlockedMap = new Map(unlockedRecords.map((r: any) => [r.badgeId, r.unlockedAt]));

  const badges = ALL_BADGES.map((badge) => ({
    ...badge,
    unlocked: unlockedMap.has(badge.id),
    unlockedAt: unlockedMap.get(badge.id) ?? null,
    isNew: newlyUnlocked.some((b) => b.id === badge.id),
  }));

  return NextResponse.json({
    badges,
    unlockedCount: unlockedMap.size,
    totalCount: ALL_BADGES.length,
    newlyUnlocked: newlyUnlocked.map((b) => b.id),
  });
}
