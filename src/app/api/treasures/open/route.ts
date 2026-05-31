// 子供用 — 宝箱を1個開封（最古の UNLOCKED に対し抽選）
//
// POST /api/treasures/open
// 戻り値:
//   { ok, miss, pityTriggered, item: {id,title,rarity} | null,
//     collectionItem: {id,name,rarity,season,description,image,count} | null,
//     remainingUnlocked: number }
// ハズレ枠 (miss=true) では現在のシーズンのコレクションアイテムを必ず 1個付与する。

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { routeLogger } from "@/lib/logger";
import { openOldestTreasure } from "@/lib/treasureService";
import { sendPushToParent } from "@/lib/push";

export async function POST() {
  const rlog = routeLogger("POST", "/api/treasures/open");
  const user = await getCurrentUser();
  if (!user || user.role !== "CHILD") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const result = await openOldestTreasure(user.id);
  if (!result) {
    return NextResponse.json({ error: "開封できる宝箱がありません" }, { status: 400 });
  }

  // 当たり時のみ親に通知（ハズレは演出のみで完結）
  if (!result.miss && user.familyId) {
    const parent = await prisma.user.findFirst({
      where: { familyId: user.familyId, role: "PARENT" },
      select: { id: true },
    });
    if (parent && result.item) {
      const childName = user.monsterName ?? user.name ?? "子供";
      await sendPushToParent(parent.id, {
        title: "🎁 ごほうびゲット！",
        body: `${childName}が宝箱から「${result.item.title}」をゲットしたよ！`,
        url: "/app/parent/treasures/pending",
      });
    }
  }

  const remainingUnlocked = await prisma.treasureLog.count({
    where: { childId: user.id, status: "UNLOCKED" },
  });

  rlog.info("Treasure opened", {
    childId: user.id,
    logId: result.logId,
    miss: result.miss,
    pityTriggered: result.pityTriggered,
  });

  return NextResponse.json({
    ok: true,
    miss: result.miss,
    pityTriggered: result.pityTriggered,
    item: result.item,
    collectionItem: result.collectionItem,
    remainingUnlocked,
  });
}
