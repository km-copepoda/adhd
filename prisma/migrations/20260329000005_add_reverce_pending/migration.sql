-- AlterTable
ALTER TABLE "User" ADD COLUMN "rebirthEggBonus" TEXT;
ALTER TABLE "User" ADD COLUMN "rebirthPending" BOOLEAN NOT NULL DEFAULT false;
