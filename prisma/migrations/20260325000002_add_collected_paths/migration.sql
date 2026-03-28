-- AlterTable: add collectedPaths to User (default="[]" for existing rows)
ALTER TABLE "User" ADD COLUMN "collectedPaths" TEXT NOT NULL DEFAULT '[]';
