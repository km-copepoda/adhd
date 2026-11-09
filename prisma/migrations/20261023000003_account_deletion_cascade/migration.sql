-- #235: アカウント削除のため、子ども/家族に紐づく 4 つの FK を ON DELETE CASCADE に変更する。
-- QuestInstance.template / TaskStreak.task は RESTRICT のまま（タスクは isActive=false の論理削除運用）。

-- DropForeignKey
ALTER TABLE "QuestInstance" DROP CONSTRAINT "QuestInstance_childId_fkey";

-- DropForeignKey
ALTER TABLE "Streak" DROP CONSTRAINT "Streak_childId_fkey";

-- DropForeignKey
ALTER TABLE "TaskStreak" DROP CONSTRAINT "TaskStreak_childId_fkey";

-- DropForeignKey
ALTER TABLE "TaskTemplate" DROP CONSTRAINT "TaskTemplate_familyId_fkey";

-- AddForeignKey
ALTER TABLE "QuestInstance" ADD CONSTRAINT "QuestInstance_childId_fkey" FOREIGN KEY ("childId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Streak" ADD CONSTRAINT "Streak_childId_fkey" FOREIGN KEY ("childId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskStreak" ADD CONSTRAINT "TaskStreak_childId_fkey" FOREIGN KEY ("childId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskTemplate" ADD CONSTRAINT "TaskTemplate_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;
