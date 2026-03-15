-- AlterEnum
ALTER TYPE "QuestStatus" ADD VALUE 'SKIPPED';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "minTasksForStreak" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "Streak" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "bestStreak" INTEGER NOT NULL DEFAULT 0,
    "lastAchievedDate" DATE,
    "restPassUsedAt" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Streak_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Streak_childId_key" ON "Streak"("childId");

-- AddForeignKey
ALTER TABLE "Streak" ADD CONSTRAINT "Streak_childId_fkey" FOREIGN KEY ("childId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
