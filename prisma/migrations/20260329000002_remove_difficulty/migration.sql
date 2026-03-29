-- AlterTable: TaskTemplate から difficulty カラムを削除
ALTER TABLE "TaskTemplate" DROP COLUMN "difficulty";

-- DropEnum: Difficulty enum を削除
DROP TYPE "Difficulty";
