-- AlterTable: add evolutionPath to User (default="" for existing rows)
ALTER TABLE "User" ADD COLUMN "evolutionPath" TEXT NOT NULL DEFAULT '';

-- Reset existing child users' evolution progress (MVP migration)
UPDATE "User" SET "evolutionStage" = 0, "evolutionPath" = '', "studyPt" = 0, "staminaPt" = 0, "lifePt" = 0 WHERE "role" = 'CHILD';
