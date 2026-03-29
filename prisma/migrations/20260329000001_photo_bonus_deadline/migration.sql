-- AlterTable: TaskTemplate.requirePhoto → photoBonus リネーム
ALTER TABLE "TaskTemplate" RENAME COLUMN "requirePhoto" TO "photoBonus";

-- AlterTable: Family に reportDeadlineTime を追加
ALTER TABLE "Family" ADD COLUMN "reportDeadlineTime" TEXT;

-- AlterTable: QuestInstance に deadlineBonusEarned を追加
ALTER TABLE "QuestInstance" ADD COLUMN "deadlineBonusEarned" BOOLEAN NOT NULL DEFAULT false;
