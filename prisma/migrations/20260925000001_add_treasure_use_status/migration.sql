-- #151: ごほうび使用を親承認フロー化する
--
-- TreasureLog に useStatus / useRequestedAt / useApprovedAt を追加する。
-- fulfilled は削除しない（useStatus===USED と同値になるよう実装側で二重書き込みする）。
--
-- バックフィル方針:
--   fulfilled=true  AND itemId IS NOT NULL -> useStatus='USED', useApprovedAt=COALESCE(openedAt, updatedAt)
--   itemId IS NULL（コレクション獲得）      -> 常に 'UNUSED'（fulfilled の値に関わらず）
--   それ以外（fulfilled=false）             -> 'UNUSED'（デフォルトのまま）

-- CreateEnum
CREATE TYPE "TreasureUseStatus" AS ENUM ('UNUSED', 'USE_REQUESTED', 'USED');

-- AlterTable
ALTER TABLE "TreasureLog"
  ADD COLUMN "useStatus" "TreasureUseStatus" NOT NULL DEFAULT 'UNUSED',
  ADD COLUMN "useRequestedAt" TIMESTAMP(3),
  ADD COLUMN "useApprovedAt" TIMESTAMP(3);

-- Backfill: 既存の fulfilled=true な実ごほうび当選行を USED として扱う
UPDATE "TreasureLog"
SET "useStatus" = 'USED',
    "useApprovedAt" = COALESCE("openedAt", "updatedAt")
WHERE "fulfilled" = true AND "itemId" IS NOT NULL;

-- CreateIndex
CREATE INDEX "TreasureLog_childId_useStatus_idx" ON "TreasureLog"("childId", "useStatus");

-- CreateIndex
CREATE INDEX "TreasureLog_useStatus_useRequestedAt_idx" ON "TreasureLog"("useStatus", "useRequestedAt");

-- Realtime: TreasureLog を postgres_changes 購読対象に追加する。
-- supabase/seed.sql 側にも同じ DO ブロックがあるが、手動で ADD TABLE 済みの環境
-- （seed.sql 未再実行）でも `prisma migrate deploy` が「既に登録済み」エラーで
-- 失敗しないよう、ここでも冪等ガード付きで実行する。
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'TreasureLog'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE "TreasureLog";
  END IF;
END $$;
