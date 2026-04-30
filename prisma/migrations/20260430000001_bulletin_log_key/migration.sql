-- Add `key` column to BulletinLog and include it in the unique constraint
-- so that multiple distinct events of the same `type` on the same date
-- (e.g., unlocking two different badges in one day) can coexist.
-- TASK_* events keep `key = ""` (default), preserving idempotent re-evaluation.

ALTER TABLE "BulletinLog"
  ADD COLUMN "key" TEXT NOT NULL DEFAULT '';

DROP INDEX "BulletinLog_groupId_childId_type_date_key";

CREATE UNIQUE INDEX "BulletinLog_groupId_childId_type_date_key_key"
  ON "BulletinLog"("groupId", "childId", "type", "date", "key");
