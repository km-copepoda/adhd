-- Move reportDeadlineTime from Family to User (per-child)
ALTER TABLE "Family" DROP COLUMN "reportDeadlineTime";
ALTER TABLE "User" ADD COLUMN "reportDeadlineTime" TEXT;
