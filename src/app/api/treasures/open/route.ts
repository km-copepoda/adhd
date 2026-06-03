// 子供用 — 宝箱を1個開封（最古の UNLOCKED に対し抽選）
//
// POST /api/treasures/open
// 戻り値:
//   { ok, item: {id,title,rarity} | null,
//     collectionItem: {id,name,rarity,season,description,image,count} | null,
//     remainingUnlocked: number }
// 親ごほうびに当選しなかった場合は collectionItem に現在シーズンのコレクションアイテムが入る。

import { NextResponse, after } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { routeLogger } from "@/lib/logger";
import { openOldestTreasure } from "@/lib/treasureService";
import { sendPushToParent } from "@/lib/push";
import { checkAndUnlockBadges } from "@/lib/badges";
import { triggerBadgeLog } from "@/lib/bulletinLog";

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

  // 親ごほうびに当選したときだけ親に通知（コレクションアイテムは演出のみで完結）
  if (result.item && user.familyId) {
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
    parentReward: !!result.item,
  });

  // 宝箱・コレクション系バッジを即時解錠（レスポンス送信後に実行）
  after(() =>
    checkAndUnlockBadges(user.id)
      .then(newBadges => {
        for (const badge of newBadges) {
          triggerBadgeLog(user.id, badge.name).catch(() => {});
        }
      })
      .catch(() => {}),
  );

  return NextResponse.json({
    ok: true,
    item: result.item,
    collectionItem: result.collectionItem,
    remainingUnlocked,
  });
}
