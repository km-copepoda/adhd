-- ごほうび（宝箱）システム導入
-- 設計: docs/reword-system-design.md
-- TreasureItem = 親が子供ごとに設定するプール
-- TreasureLog  = 宝箱1個 = 1レコード (LOCKED → UNLOCKED → OPENED の状態遷移)
-- User.treasurePityCount = 連続ハズレ天井カウンタ

CREATE TYPE "TreasureRarity" AS ENUM ('COMMON', 'UNCOMMON', 'RARE');
CREATE TYPE "TreasureTrigger" AS ENUM ('STREAK', 'ALL_COMPLETE', 'AUTO');
CREATE TYPE "TreasureStatus" AS ENUM ('LOCKED', 'UNLOCKED', 'OPENED', 'CANCELLED');

ALTER TABLE "User" ADD COLUMN "treasurePityCount" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "TreasureItem" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "rarity" "TreasureRarity" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TreasureItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TreasureItem_childId_idx" ON "TreasureItem"("childId");

ALTER TABLE "TreasureItem" ADD CONSTRAINT "TreasureItem_childId_fkey"
    FOREIGN KEY ("childId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "TreasureLog" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "trigger" "TreasureTrigger" NOT NULL,
    "boosted" BOOLEAN NOT NULL DEFAULT false,
    "status" "TreasureStatus" NOT NULL DEFAULT 'LOCKED',
    "itemId" TEXT,
    "openedAt" TIMESTAMP(3),
    "fulfilled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TreasureLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TreasureLog_childId_status_idx" ON "TreasureLog"("childId", "status");
CREATE INDEX "TreasureLog_childId_date_idx" ON "TreasureLog"("childId", "date");

ALTER TABLE "TreasureLog" ADD CONSTRAINT "TreasureLog_childId_fkey"
    FOREIGN KEY ("childId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TreasureLog" ADD CONSTRAINT "TreasureLog_itemId_fkey"
    FOREIGN KEY ("itemId") REFERENCES "TreasureItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
