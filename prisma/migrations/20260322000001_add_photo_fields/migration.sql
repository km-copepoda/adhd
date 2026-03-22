-- AlterTable: TaskTemplate に requirePhoto を追加
ALTER TABLE "TaskTemplate" ADD COLUMN "requirePhoto" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: QuestInstance に photoUrl を追加
ALTER TABLE "QuestInstance" ADD COLUMN "photoUrl" TEXT;
