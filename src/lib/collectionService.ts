// 宝箱コレクションアイテムの DB 操作層。
// 純粋データ (アイテム定義) は src/lib/collectionItems.ts。
// 純粋ロジック (抽選) は src/lib/collectionDraw.ts。
//
// 呼び出し元:
//  - 宝箱開封 (treasureService.openOldestTreasure) — 親ごほうび不当選時に awardCollectionItem
//  - /api/collection-items — getOwnedCollection で所持一覧を返す

import { prisma } from "@/lib/prisma";
import type { CollectionSeason } from "@/lib/collectionItems";

export interface OwnedCollectionRecord {
  id: string;
  childId: string;
  itemId: string;
  season: string;
  count: number;
  firstAcquiredAt: Date;
  lastAcquiredAt: Date;
}

/**
 * 子供にコレクションアイテムを 1個付与する。既に所持していれば count を +1 して
 * lastAcquiredAt を更新する。
 */
export async function awardCollectionItem(
  childId: string,
  itemId: string,
  season: CollectionSeason,
  now: Date = new Date(),
): Promise<OwnedCollectionRecord> {
  const rec = await prisma.userCollectionItem.upsert({
    where: { childId_itemId: { childId, itemId } },
    create: {
      childId,
      itemId,
      season,
      count: 1,
      firstAcquiredAt: now,
      lastAcquiredAt: now,
    },
    update: {
      count: { increment: 1 },
      lastAcquiredAt: now,
    },
  });
  return rec as OwnedCollectionRecord;
}

/**
 * 子供の所持コレクション一覧を取得する。最終獲得日時の新しい順。
 */
export async function getOwnedCollection(childId: string): Promise<OwnedCollectionRecord[]> {
  const list = await prisma.userCollectionItem.findMany({
    where: { childId },
    orderBy: { lastAcquiredAt: "desc" },
  });
  return list as OwnedCollectionRecord[];
}
