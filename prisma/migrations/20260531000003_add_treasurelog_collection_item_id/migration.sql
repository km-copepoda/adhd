-- 宝箱開封時、親ごほうび不当選 (item is null) でも何が出たか履歴で表示できるよう、
-- 付与されたコレクションアイテム id (例 "summer-01") を保存するカラムを追加。
-- マスターは src/lib/collectionItems.ts でコード管理しているため FK は張らない。

ALTER TABLE "TreasureLog" ADD COLUMN "collectionItemId" TEXT;
