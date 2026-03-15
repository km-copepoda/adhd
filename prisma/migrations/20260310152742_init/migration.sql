-- CreateEnum
CREATE TYPE "Role" AS ENUM ('PARENT', 'CHILD');

-- CreateEnum
CREATE TYPE "Side" AS ENUM ('DARK', 'LIGHT');

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('EASY', 'NORMAL', 'HARD');

-- CreateEnum
CREATE TYPE "Category" AS ENUM ('STUDY', 'STAMINA', 'LIFE');

-- CreateEnum
CREATE TYPE "QuestStatus" AS ENUM ('PENDING', 'REPORTED', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "Family" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Family_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "supabaseId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "name" TEXT,
    "side" "Side",
    "monsterName" TEXT,
    "childCode" TEXT,
    "evolutionStage" INTEGER NOT NULL DEFAULT 0,
    "studyPt" INTEGER NOT NULL DEFAULT 0,
    "staminaPt" INTEGER NOT NULL DEFAULT 0,
    "lifePt" INTEGER NOT NULL DEFAULT 0,
    "familyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskTemplate" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "emoji" TEXT NOT NULL DEFAULT '⚔️',
    "category" "Category" NOT NULL,
    "difficulty" "Difficulty" NOT NULL,
    "repeatDays" INTEGER[],
    "isTemporary" BOOLEAN NOT NULL DEFAULT false,
    "targetDate" DATE,
    "createdBy" "Role" NOT NULL DEFAULT 'PARENT',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "familyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestInstance" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" "QuestStatus" NOT NULL DEFAULT 'PENDING',
    "comment" TEXT,
    "templateId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "reportedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestInstance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Family_code_key" ON "Family"("code");

-- CreateIndex
CREATE UNIQUE INDEX "User_supabaseId_key" ON "User"("supabaseId");

-- CreateIndex
CREATE UNIQUE INDEX "User_familyId_childCode_key" ON "User"("familyId", "childCode");

-- CreateIndex
CREATE UNIQUE INDEX "QuestInstance_templateId_childId_date_key" ON "QuestInstance"("templateId", "childId", "date");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskTemplate" ADD CONSTRAINT "TaskTemplate_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestInstance" ADD CONSTRAINT "QuestInstance_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "TaskTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestInstance" ADD CONSTRAINT "QuestInstance_childId_fkey" FOREIGN KEY ("childId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
