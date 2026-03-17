-- AlterTable
ALTER TABLE "TaskTemplate" ADD COLUMN "assignedChildId" TEXT;

-- AddForeignKey
ALTER TABLE "TaskTemplate" ADD CONSTRAINT "TaskTemplate_assignedChildId_fkey" FOREIGN KEY ("assignedChildId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
