-- 宝箱コレクションアイテム導入
-- 仕様: docs/未実装仕様書/treasure-collection-items.md
-- 宝箱のハズレ枠を「何も出ない」から「季節コレクションアイテムが出る」に変更する。
-- マスターデータは src/lib/collectionItems.ts (コード管理)。DB には子供の所持実績のみ保存。

CREATE TABLE "UserCollectionItem" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "season" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "firstAcquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAcquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserCollectionItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserCollectionItem_childId_itemId_key" ON "UserCollectionItem"("childId", "itemId");
CREATE INDEX "UserCollectionItem_childId_idx" ON "UserCollectionItem"("childId");
CREATE INDEX "UserCollectionItem_childId_season_idx" ON "UserCollectionItem"("childId", "season");

ALTER TABLE "UserCollectionItem" ADD CONSTRAINT "UserCollectionItem_childId_fkey"
    FOREIGN KEY ("childId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
