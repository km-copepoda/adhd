-- Add snapshot fields to QuestInstance
-- These fields capture the task's title/emoji/category at the time the quest is created,
-- so that renaming a task does not retroactively change past quest history.

ALTER TABLE "QuestInstance" ADD COLUMN "snapshotTitle" TEXT;
ALTER TABLE "QuestInstance" ADD COLUMN "snapshotEmoji" TEXT;
ALTER TABLE "QuestInstance" ADD COLUMN "snapshotCategory" "Category";
