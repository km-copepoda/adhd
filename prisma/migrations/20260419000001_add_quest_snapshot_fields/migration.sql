-- Add snapshot fields to QuestInstance
-- These fields capture the task's title/emoji/category at the time the quest is created,
-- so that renaming a task does not retroactively change past quest history.

ALTER TABLE "QuestInstance" ADD COLUMN "snapshotTitle" TEXT;
ALTER TABLE "QuestInstance" ADD COLUMN "snapshotEmoji" TEXT;
ALTER TABLE "QuestInstance" ADD COLUMN "snapshotCategory" "Category";

-- Backfill existing records from their linked TaskTemplate
UPDATE "QuestInstance" qi
SET
  "snapshotTitle"    = t.title,
  "snapshotEmoji"    = t.emoji,
  "snapshotCategory" = t.category
FROM "TaskTemplate" t
WHERE qi."templateId" = t.id;

-- Add NOT NULL constraints after backfill
ALTER TABLE "QuestInstance" ALTER COLUMN "snapshotTitle"    SET NOT NULL;
ALTER TABLE "QuestInstance" ALTER COLUMN "snapshotEmoji"    SET NOT NULL;
ALTER TABLE "QuestInstance" ALTER COLUMN "snapshotCategory" SET NOT NULL;
